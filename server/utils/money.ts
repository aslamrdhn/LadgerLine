import Decimal from 'decimal.js';
export const roundMoney = (v: Decimal) => v.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
export function balanceJournalLines(lines: any[]) {
  const totalDebit = lines.reduce((sum, l) => sum.plus(l.debit), new Decimal(0));
  const totalCredit = lines.reduce((sum, l) => sum.plus(l.credit), new Decimal(0));
  const diff = totalDebit.minus(totalCredit);
  if (!diff.isZero()) {
    const cashLine = lines.find(l => l.accountId && l.accountId.includes('KAS'));
    if (cashLine) cashLine.debit = cashLine.debit.plus(diff);
    else lines[0].debit = lines[0].debit.plus(diff);
  }
  return lines;
}
