-- Preserve existing profiles and writes from older deployments during rollout.
ALTER TABLE "brand_profiles" ADD COLUMN "is_private" boolean DEFAULT true NOT NULL;
