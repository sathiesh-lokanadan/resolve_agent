export interface Order {
  id: string;
  date: string;
  amount: number;
  description: string;
  status: string;
}

export interface RefundRecord {
  id: string;
  orderId: string;
  amount: number;
  date: string;
  reason: string;
}

export interface Customer {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  plan: string;
  signupDate: string;
  country: string;
  orders: Order[];
  refunds: RefundRecord[];
}

export interface Article {
  id: string;
  title: string;
  category: string;
  tags: string[];
  body: string;
}

export interface Ticket {
  id: string;
  customerId: string;
  kind: string;
  subject: string;
  body: string;
}
