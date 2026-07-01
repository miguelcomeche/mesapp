
ALTER TABLE public.order_item_audit_logs DROP CONSTRAINT IF EXISTS order_item_audit_logs_action_type_check;
ALTER TABLE public.order_item_audit_logs
  ADD CONSTRAINT order_item_audit_logs_action_type_check
  CHECK (action_type IN ('created','deleted','cancelled','restored','modified','complimentary','complimentary_removed'));
