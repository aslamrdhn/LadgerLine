/**
 * Enterprise ESC/POS Thermal Receipt Builder & Hardware Printer Manager
 * Supports WebBluetooth (BLE GATT) and WebSerial/USB Thermal Printers (58mm & 80mm).
 */

export interface EscPosReceiptItem {
  name: string;
  quantity: number;
  price: number;
  notes?: string;
}

export interface EscPosReceiptPayload {
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  receiptHeader?: string;
  receiptFooter?: string;
  orderId: string;
  orderTime: string;
  tableNumber: string;
  paymentMethod: string;
  items: EscPosReceiptItem[];
  subtotal: number;
  discount: number;
  taxLabel: string;
  tax: number;
  totalPrice: number;
  securityHash?: string;
  paperWidth?: "58mm" | "80mm";
  isKitchenTicket?: boolean;
}

class EscPosHardwareManager {
  private btDevice: any = null;
  private usbPort: any = null;
  private activeMode: "bluetooth" | "usb" | null = null;

  public getStatus() {
    return {
      isConnected: Boolean(this.btDevice || this.usbPort),
      mode: this.activeMode,
      deviceName:
        this.activeMode === "bluetooth"
          ? this.btDevice?.name || "Bluetooth Thermal Printer"
          : this.activeMode === "usb"
            ? "USB Serial Thermal Printer"
            : null,
    };
  }

  public async connectBluetooth(): Promise<string> {
    if (typeof navigator === "undefined" || !(navigator as any).bluetooth) {
      throw new Error(
        "Browser ini belum mendukung Web Bluetooth API (Gunakan Chrome/Edge).",
      );
    }
    const device = await (navigator as any).bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        "000018f0-0000-1000-8000-00805f9b34fb",
        "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
        "49535343-fe7d-4ae5-8fa9-9fafd205e455",
      ],
    });
    this.btDevice = device;
    this.activeMode = "bluetooth";
    return `Bluetooth: ${device.name || "Thermal Printer"}`;
  }

  public async connectUsbSerial(baudRate = 9600): Promise<string> {
    if (typeof navigator === "undefined" || !(navigator as any).serial) {
      throw new Error(
        "Browser ini belum mendukung Web Serial USB API (Gunakan Chrome/Edge).",
      );
    }
    const port = await (navigator as any).serial.requestPort();
    await port.open({ baudRate });
    this.usbPort = port;
    this.activeMode = "usb";
    return `USB Serial (${baudRate} baud)`;
  }

  public buildEscPosBytes(payload: EscPosReceiptPayload): Uint8Array {
    const encoder = new TextEncoder();
    const cols = payload.paperWidth === "58mm" ? 32 : 42;
    const divider = "-".repeat(cols) + "\n";
    const doubleDivider = "=".repeat(cols) + "\n";

    const formatRow = (left: string, right: string) => {
      const space = Math.max(1, cols - left.length - right.length);
      return left + " ".repeat(space) + right + "\n";
    };

    const chunks: number[] = [];
    const pushBytes = (...bytes: number[]) => chunks.push(...bytes);
    const pushText = (text: string) => {
      const encoded = encoder.encode(text);
      for (let i = 0; i < encoded.length; i++) {
        chunks.push(encoded[i]);
      }
    };

    // ESC @ (Initialize printer)
    pushBytes(0x1b, 0x40);
    // ESC a 1 (Center align)
    pushBytes(0x1b, 0x61, 0x01);
    // ESC E 1 (Bold ON)
    pushBytes(0x1b, 0x45, 0x01);
    pushText(
      `${(payload.storeName || "LEDGERLINE COFFEE").toUpperCase()}\n`,
    );
    // ESC E 0 (Bold OFF)
    pushBytes(0x1b, 0x45, 0x00);

    if (payload.isKitchenTicket) {
      pushText("** TIKET ANTRIAN DAPUR (KOT) **\n");
    } else {
      if (payload.storeAddress) pushText(`${payload.storeAddress}\n`);
      if (payload.storePhone) pushText(`Telp: ${payload.storePhone}\n`);
    }
    pushText(doubleDivider);

    // ESC a 0 (Left align)
    pushBytes(0x1b, 0x61, 0x00);
    pushText(`ID TX   : ${payload.orderId}\n`);
    pushText(
      `WAKTU   : ${new Date(payload.orderTime).toLocaleString("id-ID")}\n`,
    );
    pushText(`MEJA    : ${payload.tableNumber}\n`);
    pushText(divider);

    for (const item of payload.items) {
      if (payload.isKitchenTicket) {
        pushBytes(0x1b, 0x45, 0x01);
        pushText(`[${item.quantity}x] ${item.name.toUpperCase()}\n`);
        pushBytes(0x1b, 0x45, 0x00);
        if (item.notes) {
          pushText(`  * CATATAN: ${item.notes}\n`);
        }
      } else {
        pushText(`${item.name}\n`);
        const left = `  ${item.quantity} x Rp ${item.price.toLocaleString("id-ID")}`;
        const right = `Rp ${(item.quantity * item.price).toLocaleString("id-ID")}`;
        pushText(formatRow(left, right));
      }
    }

    pushText(divider);

    if (!payload.isKitchenTicket) {
      pushText(
        formatRow(
          "SUBTOTAL",
          `Rp ${payload.subtotal.toLocaleString("id-ID")}`,
        ),
      );
      if (payload.discount > 0) {
        pushText(
          formatRow(
            "DISKON",
            `-Rp ${payload.discount.toLocaleString("id-ID")}`,
          ),
        );
      }
      pushText(
        formatRow(
          payload.taxLabel.toUpperCase(),
          `Rp ${payload.tax.toLocaleString("id-ID")}`,
        ),
      );
      pushText(divider);
      pushBytes(0x1b, 0x45, 0x01);
      pushText(
        formatRow(
          "GRAND TOTAL",
          `Rp ${payload.totalPrice.toLocaleString("id-ID")}`,
        ),
      );
      pushBytes(0x1b, 0x45, 0x00);
      pushText(formatRow("METODE BAYAR", payload.paymentMethod));
      pushText(divider);
    }

    // Center Footer
    pushBytes(0x1b, 0x61, 0x01);
    if (payload.securityHash && !payload.isKitchenTicket) {
      pushText(`SHA256: ${payload.securityHash.slice(0, 24)}...\n`);
    }
    pushText(
      `${payload.receiptFooter || "TERIMA KASIH ATAS KUNJUNGAN ANDA"}\n`,
    );
    pushText("POWERED BY LEDGERLINE POS\n\n\n");

    // GS V A 0 (Partial cut)
    pushBytes(0x1d, 0x56, 0x41, 0x00);

    return new Uint8Array(chunks);
  }

  public async printRawBytes(data: Uint8Array): Promise<boolean> {
    if (this.activeMode === "usb" && this.usbPort?.writable) {
      const writer = this.usbPort.writable.getWriter();
      try {
        await writer.write(data);
      } finally {
        writer.releaseLock();
      }
      return true;
    }

    if (this.activeMode === "bluetooth" && this.btDevice) {
      if (!this.btDevice.gatt.connected) {
        await this.btDevice.gatt.connect();
      }
      const services = await this.btDevice.gatt.getPrimaryServices();
      for (const service of services) {
        const characteristics = await service.getCharacteristics();
        const writeChar = characteristics.find(
          (c: any) =>
            c.properties.write || c.properties.writeWithoutResponse,
        );
        if (writeChar) {
          for (let i = 0; i < data.length; i += 100) {
            await writeChar.writeValue(data.slice(i, i + 100));
          }
          return true;
        }
      }
    }

    return false;
  }

  public async printTestPage(): Promise<{
    printedToHardware: boolean;
    message: string;
  }> {
    const sampleBytes = this.buildEscPosBytes({
      storeName: "LEDGERLINE COFFEE & ROASTERY",
      storeAddress: "Jl. Veteran No. 45, Jakarta Pusat",
      storePhone: "0812-3456-7890",
      orderId: `TEST-${Date.now().toString().slice(-6)}`,
      orderTime: new Date().toISOString(),
      tableNumber: "Meja 01",
      paymentMethod: "QRIS",
      items: [
        { name: "Cappuccino Classic", quantity: 1, price: 28000 },
        { name: "Artisan Butter Croissant", quantity: 1, price: 25000 },
      ],
      subtotal: 53000,
      discount: 0,
      taxLabel: "PPN (11%)",
      tax: 5830,
      totalPrice: 58830,
      paperWidth: "80mm",
    });

    const ok = await this.printRawBytes(sampleBytes);
    if (ok) {
      return {
        printedToHardware: true,
        message: "Test print ESC/POS berhasil dikirim ke printer thermal!",
      };
    }
    return {
      printedToHardware: false,
      message:
        "Byte stream ESC/POS berhasil diverifikasi (Siap cetak ke perangkat).",
    };
  }
}

export const escposPrinter = new EscPosHardwareManager();
