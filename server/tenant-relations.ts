import { prisma } from './db';
export async function validateRelations(organizationId: string, input: { contactId?: string | null; companyId?: string | null; productId?: string | null; dealId?: string | null }) {
  const checks = await Promise.all([
    input.contactId ? prisma.contact.count({ where: { id: input.contactId, organizationId } }) : 1,
    input.companyId ? prisma.company.count({ where: { id: input.companyId, organizationId } }) : 1,
    input.productId ? prisma.product.count({ where: { id: input.productId, organizationId } }) : 1,
    input.dealId ? prisma.deal.count({ where: { id: input.dealId, organizationId } }) : 1,
  ]);
  return checks.every((count) => count === 1);
}
