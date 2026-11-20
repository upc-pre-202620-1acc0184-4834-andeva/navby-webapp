export const billingKeys = {
  all: ['billing'] as const,
  wallet: ['billing', 'wallet'] as const,
  packages: ['billing', 'packages'] as const,
  transactionsAll: ['billing', 'transactions'] as const,
  transactions: (page: number, pageSize: number) =>
    ['billing', 'transactions', page, pageSize] as const,
  order: (orderId: string) => ['billing', 'order', orderId] as const,
};
