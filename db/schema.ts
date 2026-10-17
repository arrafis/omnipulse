import { integer, sqliteTable, text, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const learningTopics = sqliteTable("learning_topics", {
 slug:text("slug").primaryKey(),conceptKey:text("concept_key").notNull().unique(),title:text("title").notNull(),
 category:text("category").notNull(),level:text("level").notNull(),content:text("content").notNull(),
 addedDate:text("added_date").notNull().unique(),createdAt:text("created_at").notNull(),
});
export const storyContexts = sqliteTable("story_contexts", {
 url:text("url").primaryKey(),fingerprint:text("fingerprint").notNull(),why:text("why").notNull(),watch:text("watch").notNull(),
 sources:text("sources").notNull(),updatedAt:text("updated_at").notNull(),
});

export const articles = sqliteTable("articles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  body: text("body").notNull(),
  category: text("category").notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceName: text("source_name").notNull(),
  status: text("status").notNull().default("draft"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  publishedAt: text("published_at"),
}, (table) => [index("idx_articles_status_published").on(table.status, table.publishedAt)]);

export const editors = sqliteTable("editors", {
  id: integer("id").primaryKey(),
  userId: text("user_id").notNull(),
  email: text("email").notNull(),
  claimedAt: text("claimed_at").notNull(),
});

export const subscribers = sqliteTable("subscribers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull(),
  tokenHash: text("token_hash").notNull(),
  consentAt: text("consent_at").notNull(),
  confirmedAt: text("confirmed_at"),
  confirmTokenHash: text("confirm_token_hash"),
  confirmExpiresAt: text("confirm_expires_at"),
  confirmSentAt: text("confirm_sent_at"),
  premiumInterest: integer("premium_interest").notNull().default(0),
  plan: text("plan").notNull().default("free"),
  deliveryHour: integer("delivery_hour").notNull().default(8),
  preferredCategories: text("preferred_categories").notNull().default("AI,Tech,Markets"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeSubscriptionStatus: text("stripe_subscription_status"),
}, (table) => [uniqueIndex("idx_subscribers_email").on(table.email), uniqueIndex("idx_subscribers_token").on(table.tokenHash)]);

export const feedItems = sqliteTable("feed_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  url: text("url").notNull().unique(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  source: text("source").notNull(),
  publishedAt: text("published_at").notNull(),
  fetchedAt: text("fetched_at").notNull(),
  summary: text("summary").notNull().default(""),
}, (table) => [index("idx_feed_items_published").on(table.publishedAt)]);

export const feedSync = sqliteTable("feed_sync", {
  id: integer("id").primaryKey(),
  checkedAt: text("checked_at"),
  successAt: text("success_at"),
  nextAt: text("next_at").notNull(),
  error: text("error"),
});

export const newsletterDeliveries = sqliteTable("newsletter_deliveries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  subscriberId: integer("subscriber_id").notNull(),
  deliveryDate: text("delivery_date").notNull(),
  status: text("status").notNull().default("pending"),
  attemptedAt: text("attempted_at").notNull(),
  sentAt: text("sent_at"),
  providerId: text("provider_id"),
}, (table) => [uniqueIndex("idx_newsletter_once_per_day").on(table.subscriberId, table.deliveryDate)]);

export const premiumCheckout = sqliteTable("premium_checkout", {
  subscriberId: integer("subscriber_id").primaryKey(),
  sessionId: text("session_id"),
  checkoutUrl: text("checkout_url"),
  expiresAt: text("expires_at").notNull(),
});

export const premiumTestState = sqliteTable("premium_test_state", {
 subscriberId: integer("subscriber_id").primaryKey(),
 customerId: text("customer_id").notNull(),
 subscriptionId: text("subscription_id").notNull(),
 status: text("status").notNull(),
 plan: text("plan").notNull().default("free"),
 updatedAt: text("updated_at").notNull(),
});
export const premiumTestCheckout = sqliteTable("premium_test_checkout", {
 subscriberId: integer("subscriber_id").primaryKey(),
 sessionId: text("session_id"),
 checkoutUrl: text("checkout_url"),
 expiresAt: text("expires_at").notNull(),
});
