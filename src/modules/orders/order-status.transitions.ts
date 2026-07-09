import { OrderStatusE } from '../../common/enums/order-status.enum';

const ALLOWED_TRANSITIONS: Record<OrderStatusE, OrderStatusE[]> = {
  [OrderStatusE.PENDING]: [OrderStatusE.PROCESSING, OrderStatusE.CANCELLED],
  [OrderStatusE.PROCESSING]: [OrderStatusE.SHIPPED, OrderStatusE.CANCELLED],
  [OrderStatusE.SHIPPED]: [OrderStatusE.COMPLETE],
  [OrderStatusE.COMPLETE]: [],
  [OrderStatusE.CANCELLED]: [],
};

export function isValidOrderStatusTransition(
  from: OrderStatusE,
  to: OrderStatusE,
): boolean {
  if (from === to) {
    return true;
  }

  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
