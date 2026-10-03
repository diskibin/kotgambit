import { z } from 'zod';

/**
 * What the cat can wear. `none` is the plain cat with the butterfly, the first item of the wardrobe that every
 * learner has. The others are rewards: the rules for opening them live on the server, the names in the locales.
 */
export const ACCESSORY_KEYS = ['none', 'scarf', 'glasses', 'crown', 'hat', 'medal'] as const;
export const AccessoryKeySchema = z.enum(ACCESSORY_KEYS);
export type AccessoryKey = z.infer<typeof AccessoryKeySchema>;

export const WardrobeSchema = z.object({
  /** What the cat wears now, everywhere in the product. */
  selected: AccessoryKeySchema,
  items: z.array(z.object({ key: AccessoryKeySchema, unlocked: z.boolean() })),
});
export type Wardrobe = z.infer<typeof WardrobeSchema>;

export const SetAccessoryRequestSchema = z.object({ accessory: AccessoryKeySchema });
export type SetAccessoryRequest = z.infer<typeof SetAccessoryRequestSchema>;
