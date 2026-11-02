-- ====================================================================
-- WEBRAJYA POS - HISTORICAL REVENUE BALANCE (OPTIONAL)
-- ====================================================================
-- Records past net revenue: ₹212,098 (Subtotal: ₹211,298 | Packaging: ₹800)
-- Does NOT take up Bill #1 or Token #1.
-- Live POS billing will start fresh at Bill #1 and Token #1!
-- ====================================================================

INSERT INTO public.orders (
  id,
  order_type,
  customer_name,
  subtotal,
  packaging_charge,
  grand_total,
  payment_status,
  payment_method,
  order_status,
  items,
  created_at,
  updated_at
) VALUES (
  'HISTORICAL-OPENING-REVENUE',
  'dine-in',
  'Historical Revenue Balance (865 Orders)',
  211298.00,
  800.00,
  212098.00,
  'Paid',
  'UPI',
  'Completed',
  '[]'::jsonb,
  '2026-10-30T23:59:59+05:30',
  '2026-10-30T23:59:59+05:30'
) ON CONFLICT (id) DO UPDATE SET 
  grand_total = EXCLUDED.grand_total,
  subtotal = EXCLUDED.subtotal,
  packaging_charge = EXCLUDED.packaging_charge;

NOTIFY pgrst, 'reload schema';
