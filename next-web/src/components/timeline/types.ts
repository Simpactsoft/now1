export type QuoteEventPayload = {
    quote_number: string;
    amount: number;
    status: string;
    currency: string;
};

export type ActivityEventPayload = {
    title: string;
    type: string;
    priority: string;
};

export type BaseActivityEvent<T extends string, P> = {
    id: string;
    organization_id: string;
    entity_id: string;
    entity_type: string;
    event_type: T;
    occurred_at: string;
    actor_id: string | null;
    actor_metadata: { email?: string; name?: string } | null;
    payload: P;
    source_id: string;
    source_table: string;
    created_at: string;
};

export type QuoteCreatedEvent = BaseActivityEvent<"quote_created", QuoteEventPayload>;
export type QuoteUpdatedEvent = BaseActivityEvent<"quote_updated", QuoteEventPayload>;
export type QuoteDeletedEvent = BaseActivityEvent<"quote_deleted", QuoteEventPayload>;

export type ActivityCreatedEvent = BaseActivityEvent<"activity_created", ActivityEventPayload>;
export type ActivityUpdatedEvent = BaseActivityEvent<"activity_updated", ActivityEventPayload>;
export type ActivityDeletedEvent = BaseActivityEvent<"activity_deleted", ActivityEventPayload>;

export type ActivityStreamEvent =
    | QuoteCreatedEvent
    | QuoteUpdatedEvent
    | QuoteDeletedEvent
    | ActivityCreatedEvent
    | ActivityUpdatedEvent
    | ActivityDeletedEvent;
