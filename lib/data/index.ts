import customersJson from "./customers.json";
import articlesJson from "./articles.json";
import ticketsJson from "./tickets.json";
import type { Article, Customer, Order, Ticket } from "./types";

export const customers = customersJson as Customer[];
export const articles = articlesJson as Article[];
export const tickets = ticketsJson as Ticket[];

/** The sample data is frozen in time so refund-window checks are repeatable. */
export const FIXTURE_NOW = "2026-11-10";

export const SOURCES = {
  customers: "lib/data/customers.json",
  articles: "lib/data/articles.json",
  tickets: "lib/data/tickets.json",
} as const;

export function ageInDays(date: string): number {
  return Math.floor((Date.parse(FIXTURE_NOW) - Date.parse(date)) / 86_400_000);
}

export function findCustomer(id?: string, email?: string): Customer | undefined {
  return customers.find(
    (c) => (id && c.id === id) || (email && c.email.toLowerCase() === email.toLowerCase()),
  );
}

export function findOrder(orderId: string): { order: Order; customer: Customer } | undefined {
  for (const customer of customers) {
    const order = customer.orders.find((o) => o.id === orderId);
    if (order) return { order, customer };
  }
}

export const findArticle = (id: string) => articles.find((a) => a.id === id);
export const findTicket = (id: string) => tickets.find((t) => t.id === id);
