
-- 1. Create Tables
CREATE TABLE IF NOT EXISTS public.relationship_types (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    reverse_name text,
    is_directional boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT uniq_rel_type_name_tenant UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS public.entity_relationships (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL,
    source_id uuid NOT NULL, 
    target_id uuid NOT NULL,
    type_id uuid NOT NULL REFERENCES public.relationship_types(id) ON DELETE CASCADE,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT no_self_links CHECK (source_id != target_id),
    CONSTRAINT uniq_entity_link UNIQUE (source_id, target_id, type_id)
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_rel_source ON public.entity_relationships(source_id);
CREATE INDEX IF NOT EXISTS idx_rel_target ON public.entity_relationships(target_id);
CREATE INDEX IF NOT EXISTS idx_rel_type ON public.entity_relationships(type_id);

-- 3. RLS
ALTER TABLE public.relationship_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view_rel_types" ON public.relationship_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage_rel_types" ON public.relationship_types FOR ALL TO authenticated USING (true);

CREATE POLICY "view_relationships" ON public.entity_relationships FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage_relationships" ON public.entity_relationships FOR ALL TO authenticated USING (true);

-- 4. Functions (Fixed with search_path)
CREATE OR REPLACE FUNCTION public.get_entity_relationships(p_entity_id UUID)
RETURNS TABLE (
    rel_id UUID,
    rel_type TEXT,
    rel_type_id UUID,
    direction TEXT,
    target_id UUID,
    target_name TEXT,
    target_type TEXT,
    target_contact_methods JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        er.id as rel_id,
        rt.name as rel_type,
        rt.id as rel_type_id,
        'forward' as direction,
        c.id as target_id,
        c.display_name as target_name,
        c.type as target_type,
        c.contact_methods as target_contact_methods
    FROM public.entity_relationships er
    JOIN public.relationship_types rt ON er.type_id = rt.id
    JOIN public.cards c ON er.target_id = c.id
    WHERE er.source_id = p_entity_id
    UNION ALL
    SELECT 
        er.id as rel_id,
        COALESCE(rt.reverse_name, rt.name) as rel_type,
        rt.id as rel_type_id,
        'inverse' as direction,
        c.id as target_id,
        c.display_name as target_name,
        c.type as target_type,
        c.contact_methods as target_contact_methods
    FROM public.entity_relationships er
    JOIN public.relationship_types rt ON er.type_id = rt.id
    JOIN public.cards c ON er.source_id = c.id
    WHERE er.target_id = p_entity_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_entity_relationship(
    p_tenant_id UUID,
    p_source_id UUID,
    p_target_id UUID,
    p_type_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_type_id UUID;
    v_rel_id UUID;
BEGIN
    SELECT id INTO v_type_id FROM public.relationship_types 
    WHERE tenant_id = p_tenant_id AND name ILIKE p_type_name LIMIT 1;

    IF v_type_id IS NULL THEN
        INSERT INTO public.relationship_types (tenant_id, name, is_directional)
        VALUES (p_tenant_id, p_type_name, true)
        RETURNING id INTO v_type_id;
    END IF;

    INSERT INTO public.entity_relationships (tenant_id, source_id, target_id, type_id)
    VALUES (p_tenant_id, p_source_id, p_target_id, v_type_id)
    RETURNING id INTO v_rel_id;

    RETURN v_rel_id;
END;
$$;

-- 5. Permissions
GRANT ALL ON TABLE public.relationship_types TO authenticated, service_role;
GRANT ALL ON TABLE public.entity_relationships TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_entity_relationships(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_entity_relationship(UUID, UUID, UUID, TEXT) TO authenticated, service_role;
