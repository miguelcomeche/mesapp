CREATE OR REPLACE FUNCTION public.sales_ledger(_restaurant uuid, _from timestamptz, _to timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _r restaurants; _f timestamptz := _from;
BEGIN
  IF NOT public.can_access_restaurant(_restaurant) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  SELECT * INTO _r FROM restaurants WHERE id = _restaurant;
  IF _r.type = 'production' AND _r.production_start_date IS NOT NULL THEN
    _f := greatest(_from, _r.production_start_date::timestamptz);
  END IF;
  RETURN jsonb_build_object(
    'restaurant', jsonb_build_object('name',_r.name,'commercial_name',_r.commercial_name,'legal_name',_r.legal_name,
       'tax_id',_r.tax_id,'address',_r.address,'postal_code',_r.postal_code,'city',_r.city,'province',_r.province,
       'type',_r.type,'production_start_date',_r.production_start_date),
    'from', _f, 'to', _to,
    'tickets', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', ts.id, 'ticket_number', ts.ticket_number, 'closed_at', ts.closed_at, 'started_at', ts.started_at,
        'table', t.number, 'waiter', w.name, 'guests', ts.guest_count,
        'items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
            'name', COALESCE(oi.product_name_snapshot, m.name), 'qty', oi.quantity, 'unit_price', oi.unit_price,
            'vat', COALESCE(oi.vat_rate_snapshot, m.vat_rate, 10), 'status', oi.status,
            'complimentary', oi.is_complimentary, 'deleted', oi.deleted_at IS NOT NULL,
            'mods', COALESCE((SELECT sum(oim.price) FROM order_item_modifiers oim WHERE oim.order_item_id = oi.id),0)))
          FROM orders o JOIN order_items oi ON oi.order_id = o.id LEFT JOIN menu_items m ON m.id = oi.menu_item_id
          WHERE o.session_id = ts.id), '[]'::jsonb)
      ) ORDER BY ts.closed_at)
      FROM table_sessions ts LEFT JOIN tables t ON t.id = ts.table_id LEFT JOIN waiters w ON w.id = ts.closed_by_waiter_id
      WHERE ts.restaurant_id = _restaurant AND ts.status = 'closed' AND ts.closed_at >= _f AND ts.closed_at <= _to), '[]'::jsonb),
    'payments', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'session_id', p.session_id, 'amount', p.amount, 'tip', COALESCE(p.tip,0), 'method', p.method,
        'discount', p.discount_amount, 'voided', p.voided, 'processed_at', p.processed_at,
        'void_reason', (SELECT v.reason FROM payment_voids v WHERE v.payment_id = p.id LIMIT 1)) ORDER BY p.processed_at)
      FROM payments p JOIN table_sessions ts ON ts.id = p.session_id
      WHERE ts.restaurant_id = _restaurant AND ts.status = 'closed' AND ts.closed_at >= _f AND ts.closed_at <= _to), '[]'::jsonb),
    'refunds', COALESCE((SELECT jsonb_agg(to_jsonb(rf) ORDER BY rf.created_at) FROM refunds rf
      JOIN table_sessions ts ON ts.id = rf.session_id
      WHERE rf.restaurant_id = _restaurant AND ts.closed_at >= _f AND ts.closed_at <= _to), '[]'::jsonb),
    'invoices', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'invoice_number', i.invoice_number,
        'issued_at', i.issued_at, 'customer', i.customer_legal_name, 'tax_id', i.customer_tax_id, 'session_id', i.session_id,
        'subtotal', i.subtotal, 'tax_total', i.tax_total, 'total', i.total, 'type', i.type, 'status', i.status) ORDER BY i.issued_at)
      FROM invoices i WHERE i.restaurant_id = _restaurant AND i.issued_at >= _f AND i.issued_at <= _to), '[]'::jsonb),
    'cash_sessions', COALESCE((SELECT jsonb_agg(to_jsonb(cs) - 'signature' ORDER BY cs.opened_at) FROM cash_sessions cs
      WHERE cs.restaurant_id = _restaurant AND cs.opened_at >= _f AND cs.opened_at <= _to), '[]'::jsonb)
  );
END $$;