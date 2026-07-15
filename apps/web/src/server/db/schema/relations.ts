import { relations } from "drizzle-orm";
import {
  aiConversations,
  aiMessages,
  bookings,
  crmActivities,
  crmOpportunities,
  crmPipelines,
  crmStages,
  customers,
  files,
  integrations,
  invoices,
  leads,
  notifications,
  pageSections,
  pages,
  payments,
  services,
  settings,
  siteDomains,
  siteVersions,
  sites,
  teamMembers,
  users,
  workspaces,
} from "./tables";

/*
 * Drizzle relations power the type-safe relational query API (`db.query.*`).
 * They are purely a runtime/typing convenience and produce no SQL — the
 * actual referential integrity lives in the foreign keys defined in tables.ts.
 */

export const usersRelations = relations(users, ({ many }) => ({
  ownedWorkspaces: many(workspaces),
  memberships: many(teamMembers),
  conversations: many(aiConversations),
  notifications: many(notifications),
  files: many(files),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, {
    fields: [workspaces.ownerId],
    references: [users.id],
  }),
  members: many(teamMembers),
  customers: many(customers),
  services: many(services),
  bookings: many(bookings),
  invoices: many(invoices),
  payments: many(payments),
  conversations: many(aiConversations),
  notifications: many(notifications),
  integrations: many(integrations),
  files: many(files),
  settings: one(settings),
  sites: many(sites),
  leads: many(leads),
}));

export const teamMembersRelations = relations(teamMembers, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [teamMembers.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
  bookings: many(bookings),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [customers.workspaceId],
    references: [workspaces.id],
  }),
  bookings: many(bookings),
  invoices: many(invoices),
  payments: many(payments),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [services.workspaceId],
    references: [workspaces.id],
  }),
  bookings: many(bookings),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [bookings.workspaceId],
    references: [workspaces.id],
  }),
  customer: one(customers, {
    fields: [bookings.customerId],
    references: [customers.id],
  }),
  service: one(services, {
    fields: [bookings.serviceId],
    references: [services.id],
  }),
  staff: one(teamMembers, {
    fields: [bookings.staffId],
    references: [teamMembers.id],
  }),
  payments: many(payments),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [invoices.workspaceId],
    references: [workspaces.id],
  }),
  customer: one(customers, {
    fields: [invoices.customerId],
    references: [customers.id],
  }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [payments.workspaceId],
    references: [workspaces.id],
  }),
  customer: one(customers, {
    fields: [payments.customerId],
    references: [customers.id],
  }),
  booking: one(bookings, {
    fields: [payments.bookingId],
    references: [bookings.id],
  }),
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
}));

export const aiConversationsRelations = relations(
  aiConversations,
  ({ one, many }) => ({
    workspace: one(workspaces, {
      fields: [aiConversations.workspaceId],
      references: [workspaces.id],
    }),
    user: one(users, {
      fields: [aiConversations.userId],
      references: [users.id],
    }),
    messages: many(aiMessages),
  }),
);

export const aiMessagesRelations = relations(aiMessages, ({ one }) => ({
  conversation: one(aiConversations, {
    fields: [aiMessages.conversationId],
    references: [aiConversations.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [notifications.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const integrationsRelations = relations(integrations, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [integrations.workspaceId],
    references: [workspaces.id],
  }),
}));

export const filesRelations = relations(files, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [files.workspaceId],
    references: [workspaces.id],
  }),
  uploadedBy: one(users, {
    fields: [files.uploadedById],
    references: [users.id],
  }),
}));

export const settingsRelations = relations(settings, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [settings.workspaceId],
    references: [workspaces.id],
  }),
}));

export const sitesRelations = relations(sites, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [sites.workspaceId],
    references: [workspaces.id],
  }),
  pages: many(pages),
  versions: many(siteVersions),
  domains: many(siteDomains),
  leads: many(leads),
}));

export const siteDomainsRelations = relations(siteDomains, ({ one }) => ({
  site: one(sites, {
    fields: [siteDomains.siteId],
    references: [sites.id],
  }),
  workspace: one(workspaces, {
    fields: [siteDomains.workspaceId],
    references: [workspaces.id],
  }),
}));

export const siteVersionsRelations = relations(siteVersions, ({ one }) => ({
  site: one(sites, {
    fields: [siteVersions.siteId],
    references: [sites.id],
  }),
  workspace: one(workspaces, {
    fields: [siteVersions.workspaceId],
    references: [workspaces.id],
  }),
  createdBy: one(users, {
    fields: [siteVersions.createdBy],
    references: [users.id],
  }),
}));

export const pagesRelations = relations(pages, ({ one, many }) => ({
  site: one(sites, {
    fields: [pages.siteId],
    references: [sites.id],
  }),
  workspace: one(workspaces, {
    fields: [pages.workspaceId],
    references: [workspaces.id],
  }),
  sections: many(pageSections),
}));

export const pageSectionsRelations = relations(pageSections, ({ one }) => ({
  page: one(pages, {
    fields: [pageSections.pageId],
    references: [pages.id],
  }),
  site: one(sites, {
    fields: [pageSections.siteId],
    references: [sites.id],
  }),
  workspace: one(workspaces, {
    fields: [pageSections.workspaceId],
    references: [workspaces.id],
  }),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [leads.workspaceId],
    references: [workspaces.id],
  }),
  site: one(sites, {
    fields: [leads.siteId],
    references: [sites.id],
  }),
  convertedCustomer: one(customers, {
    fields: [leads.convertedCustomerId],
    references: [customers.id],
  }),
  opportunities: many(crmOpportunities),
}));

export const crmPipelinesRelations = relations(crmPipelines, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [crmPipelines.workspaceId],
    references: [workspaces.id],
  }),
  stages: many(crmStages),
  opportunities: many(crmOpportunities),
}));

export const crmStagesRelations = relations(crmStages, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [crmStages.workspaceId],
    references: [workspaces.id],
  }),
  pipeline: one(crmPipelines, {
    fields: [crmStages.pipelineId],
    references: [crmPipelines.id],
  }),
  opportunities: many(crmOpportunities),
}));

export const crmOpportunitiesRelations = relations(
  crmOpportunities,
  ({ one, many }) => ({
    workspace: one(workspaces, {
      fields: [crmOpportunities.workspaceId],
      references: [workspaces.id],
    }),
    pipeline: one(crmPipelines, {
      fields: [crmOpportunities.pipelineId],
      references: [crmPipelines.id],
    }),
    stage: one(crmStages, {
      fields: [crmOpportunities.stageId],
      references: [crmStages.id],
    }),
    lead: one(leads, {
      fields: [crmOpportunities.leadId],
      references: [leads.id],
    }),
    customer: one(customers, {
      fields: [crmOpportunities.customerId],
      references: [customers.id],
    }),
    assignedTo: one(users, {
      fields: [crmOpportunities.assignedToUserId],
      references: [users.id],
    }),
    activities: many(crmActivities),
  }),
);

export const crmActivitiesRelations = relations(crmActivities, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [crmActivities.workspaceId],
    references: [workspaces.id],
  }),
  opportunity: one(crmOpportunities, {
    fields: [crmActivities.opportunityId],
    references: [crmOpportunities.id],
  }),
  actor: one(users, {
    fields: [crmActivities.actorUserId],
    references: [users.id],
  }),
}));
