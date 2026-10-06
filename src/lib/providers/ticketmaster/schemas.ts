import { z } from 'zod';

const nullableString = z.string().nullable().optional();

export const ticketmasterAttractionSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const ticketmasterAttractionsResponseSchema = z.object({
  _embedded: z
    .object({
      attractions: z.array(ticketmasterAttractionSchema).default([]),
    })
    .optional(),
});

const ticketmasterVenueSchema = z.object({
  name: nullableString,
  city: z.object({ name: nullableString }).optional(),
  country: z.object({ countryCode: nullableString }).optional(),
  location: z
    .object({
      latitude: nullableString,
      longitude: nullableString,
    })
    .optional(),
});

const ticketmasterStatusSchema = z.object({
  code: z.string().optional(),
});

const ticketmasterStartSchema = z.object({
  dateTime: nullableString,
  timezone: nullableString,
});

const ticketmasterSalesSchema = z.object({
  public: z.object({ startDateTime: nullableString }).optional(),
  presales: z
    .array(
      z.object({
        name: z.string().optional(),
        startDateTime: z.string().optional(),
        endDateTime: nullableString,
      })
    )
    .optional(),
});

export const ticketmasterEventSchema = z.object({
  id: z.string(),
  name: z.string().optional().default('Untitled event'),
  url: z.string().url().optional(),
  dates: z
    .object({
      start: ticketmasterStartSchema.optional(),
      status: ticketmasterStatusSchema.optional(),
    })
    .optional(),
  sales: ticketmasterSalesSchema.optional(),
  _embedded: z
    .object({
      venues: z.array(ticketmasterVenueSchema).default([]),
      attractions: z.array(ticketmasterAttractionSchema).default([]),
    })
    .optional(),
});

export const ticketmasterEventsResponseSchema = z.object({
  _embedded: z
    .object({
      events: z.array(ticketmasterEventSchema).default([]),
    })
    .optional(),
});

export type TicketmasterEvent = z.infer<typeof ticketmasterEventSchema>;
