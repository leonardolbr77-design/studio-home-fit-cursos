// Situação dos pedidos: texto e tom (cor + ícone sempre juntos, nunca só a cor)
export const ORDER_STATUS = {
  paid: { label: 'Pago', tone: 'good', icon: 'check' },
  pending: { label: 'Aguardando pagamento', tone: 'warning', icon: 'clock' },
  failed: { label: 'Recusado', tone: 'critical', icon: 'x' },
  cancelled: { label: 'Cancelado', tone: 'neutral', icon: 'x' },
  refunded: { label: 'Estornado', tone: 'serious', icon: 'refresh' },
}

export const PROVIDER = { mercadopago: 'Mercado Pago', test: 'Teste', manual: 'Manual' }

export const PAYMENT_METHOD = {
  pix: 'Pix',
  bank_transfer: 'Pix',
  credit_card: 'Cartão de crédito',
  debit_card: 'Cartão de débito',
  ticket: 'Boleto',
  account_money: 'Saldo Mercado Pago',
  teste: 'Teste',
  cash: 'Dinheiro',
  other: 'Outro pagamento externo',
  courtesy: 'Cortesia',
}

export const shortId = (id) => String(id ?? '').slice(0, 8).toUpperCase()

export const formatDate = (iso, withTime = true) =>
  iso
    ? new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
      })
    : ''
