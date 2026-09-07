import re

with open("src/components/cashier/CheckoutResultPanel.tsx", "r") as f:
    text = f.read()

bad = """      // Buka dialog printer web browser orisinil untuk real-world hardware compatibility
      const printFriendly = window.open("", "_blank");
      if (printFriendly) {
        printFriendly.document.write(`<pre style="font-family: monospace; font-size:12px; padding:20px;">${receiptText}</pre>`);
        printFriendly.document.close();
        printFriendly.focus();
        printFriendly.print();
        printFriendly.close();
      }"""

good = """      // Buka dialog printer web browser orisinil untuk real-world hardware compatibility
      const printFriendly = window.open("", "_blank");
      if (printFriendly) {
        const enhancedReceiptHTML = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Cetak Struk</title>
            <style>
              @page { margin: 0; }
              body { 
                font-family: 'Courier New', Courier, monospace; 
                width: 58mm; 
                margin: 0 auto; 
                padding: 10px; 
                font-size: 12px; 
                color: #000;
              }
              .center { text-align: center; }
              .divider { border-top: 1px dashed #000; margin: 5px 0; }
              .flex-row { display: flex; justify-content: space-between; }
            </style>
          </head>
          <body>
            <div class="center">
              <strong>${appConfig.storeName ? appConfig.storeName.toUpperCase() : 'LEDGERLINE BY ASLAM'}</strong><br/>
              ${appConfig.storeAddress || 'Indonesia'}<br/>
              TELP: ${appConfig.storePhone || '0812-9988-7766'}<br/>
              ${appConfig.receiptHeader ? appConfig.receiptHeader.toUpperCase() + '<br/>' : ''}
            </div>
            <div class="divider"></div>
            <div>ID TX: ${checkoutResult.order.id}</div>
            <div>TANGGAL: ${new Date(checkoutResult.order.orderTime).toLocaleString('id-ID')}</div>
            <div>KASIR: Shift Kopi Utama</div>
            <div>MEJA: ${checkoutResult.order.tableNumber}</div>
            <div class="divider"></div>
            ${checkoutResult.order.items.map(item => `
              <div><strong>${item.quantity}x ${item.product.name}</strong></div>
              <div class="flex-row">
                <span>Rp ${item.product.price.toLocaleString('id-ID')}</span>
                <span>Rp ${(item.product.price * item.quantity).toLocaleString('id-ID')}</span>
              </div>
            `).join('')}
            <div class="divider"></div>
            <div class="flex-row"><span>SUBTOTAL:</span><span>Rp ${checkoutResult.order.subtotal.toLocaleString('id-ID')}</span></div>
            <div class="flex-row"><span>DISKON:</span><span>-Rp ${checkoutResult.order.discount.toLocaleString('id-ID')}</span></div>
            <div class="flex-row"><span>PAJAK:</span><span>Rp ${checkoutResult.order.tax.toLocaleString('id-ID')}</span></div>
            <div class="divider"></div>
            <div class="flex-row"><strong>TOTAL:</strong><strong>Rp ${checkoutResult.order.totalPrice.toLocaleString('id-ID')}</strong></div>
            <div class="divider"></div>
            <div class="center">
              Terima Kasih!<br/>
              Simpan struk ini sebagai bukti pembayaran.
            </div>
          </body>
          </html>
        `;
        printFriendly.document.write(enhancedReceiptHTML);
        printFriendly.document.close();
        printFriendly.focus();
        setTimeout(() => {
          printFriendly.print();
          printFriendly.close();
        }, 500);
      }"""

text = text.replace(bad, good)

with open("src/components/cashier/CheckoutResultPanel.tsx", "w") as f:
    f.write(text)
