--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9 (Debian 16.9-1.pgdg120+1)
-- Dumped by pg_dump version 17.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: generate_subdomain(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_subdomain(instance_name text) RETURNS text
    LANGUAGE plpgsql
    AS $_$
BEGIN
    -- Convert to lowercase, replace spaces with hyphens, remove special chars
    RETURN LOWER(
        REGEXP_REPLACE(
            REGEXP_REPLACE(
                REGEXP_REPLACE(instance_name, '[^a-zA-Z0-9\s-]', '', 'g'),
                '\s+', '-', 'g'
            ),
            '^-+|-+$', '', 'g'
        )
    );
END;
$_$;


--
-- Name: get_current_billing_period(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_current_billing_period(user_id_param integer) RETURNS TABLE(period_start date, period_end date)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        us.current_period_start::DATE,
        us.current_period_end::DATE
    FROM user_subscriptions us
    WHERE us.user_id = user_id_param 
      AND us.status = 'active'
    ORDER BY us.created_at DESC
    LIMIT 1;
END;
$$;


--
-- Name: record_usage_event(integer, integer, character varying, character varying, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_usage_event(user_id_param integer, instance_id_param integer, event_type_param character varying, event_subtype_param character varying DEFAULT NULL::character varying, quantity_param integer DEFAULT 1, metadata_param jsonb DEFAULT '{}'::jsonb) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    billing_start DATE;
    billing_end DATE;
    event_id INTEGER;
BEGIN
    -- Get current billing period
    SELECT period_start, period_end INTO billing_start, billing_end
    FROM get_current_billing_period(user_id_param);
    
    -- If no active subscription, use current month
    IF billing_start IS NULL THEN
        billing_start := DATE_TRUNC('month', CURRENT_DATE);
        billing_end := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE;
    END IF;
    
    -- Insert usage event
    INSERT INTO usage_events (
        user_id, instance_id, event_type, event_subtype, quantity, metadata,
        billing_period_start, billing_period_end
    ) VALUES (
        user_id_param, instance_id_param, event_type_param, event_subtype_param, 
        quantity_param, metadata_param, billing_start, billing_end
    ) RETURNING usage_events.event_id INTO event_id;
    
    -- Update quota usage
    INSERT INTO user_quotas (user_id, quota_type, current_period_start, current_period_end, current_usage)
    VALUES (user_id_param, event_type_param, billing_start, billing_end, quantity_param)
    ON CONFLICT (user_id, quota_type, current_period_start)
    DO UPDATE SET current_usage = user_quotas.current_usage + quantity_param;
    
    RETURN event_id;
END;
$$;


--
-- Name: update_email_filing_configs_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_email_filing_configs_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_system_config_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_system_config_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_user_subscriptions_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_user_subscriptions_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: billing_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_invoices (
    invoice_id integer NOT NULL,
    user_id integer NOT NULL,
    invoice_number character varying(20) NOT NULL,
    billing_period_start date NOT NULL,
    billing_period_end date NOT NULL,
    subtotal numeric(10,2) DEFAULT 0 NOT NULL,
    tax_amount numeric(10,2) DEFAULT 0,
    total_amount numeric(10,2) DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    due_date date NOT NULL,
    paid_at timestamp with time zone,
    invoice_data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: billing_invoices_invoice_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.billing_invoices_invoice_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: billing_invoices_invoice_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.billing_invoices_invoice_id_seq OWNED BY public.billing_invoices.invoice_id;


--
-- Name: email_configurations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_configurations (
    id integer NOT NULL,
    instance_id integer,
    config_type character varying(20) NOT NULL,
    email_address character varying(255) NOT NULL,
    graph_client_id_encrypted text,
    graph_client_secret_encrypted text,
    graph_tenant_id_encrypted text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_tested_at timestamp without time zone,
    test_status character varying(20),
    test_error text,
    auto_extract_control_numbers boolean DEFAULT true,
    control_number_patterns text[],
    include_attachments boolean DEFAULT true,
    default_folder_id integer DEFAULT 3,
    last_processed_timestamp timestamp with time zone DEFAULT '2024-01-01 00:00:00+00'::timestamp with time zone,
    email_prefix character varying(100),
    email_system_type character varying(20) DEFAULT 'legacy'::character varying,
    CONSTRAINT chk_email_prefix_format CHECK (((email_prefix)::text ~ '^[a-z0-9]([a-z0-9._-]{0,62}[a-z0-9])?$'::text)),
    CONSTRAINT email_configurations_email_system_type_check CHECK (((email_system_type)::text = ANY ((ARRAY['legacy'::character varying, 'subdomain'::character varying])::text[])))
);


--
-- Name: ims_instances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ims_instances (
    instance_id integer NOT NULL,
    user_id integer NOT NULL,
    name character varying(255) NOT NULL,
    url character varying(255) NOT NULL,
    username character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    email_config jsonb,
    email_status character varying(20) DEFAULT 'not_configured'::character varying,
    email_subdomain character varying(100) NOT NULL,
    CONSTRAINT chk_email_status CHECK (((email_status)::text = ANY ((ARRAY['not_configured'::character varying, 'configuring'::character varying, 'active'::character varying, 'error'::character varying, 'disabled'::character varying])::text[]))),
    CONSTRAINT chk_email_subdomain_format CHECK (((email_subdomain)::text ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'::text))
);


--
-- Name: email_config_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.email_config_summary AS
 SELECT ii.instance_id,
    ii.name AS instance_name,
    ii.email_subdomain AS unique_identifier,
    ec.id AS config_id,
    ec.email_prefix,
    ec.email_address,
    ec.config_type,
    ec.email_system_type,
    ec.test_status
   FROM (public.ims_instances ii
     LEFT JOIN public.email_configurations ec ON ((ii.instance_id = ec.instance_id)))
  ORDER BY ii.name, ec.email_prefix;


--
-- Name: email_configurations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.email_configurations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: email_configurations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.email_configurations_id_seq OWNED BY public.email_configurations.id;


--
-- Name: email_filing_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_filing_attachments (
    attachment_id integer NOT NULL,
    log_id integer NOT NULL,
    filename character varying(255) NOT NULL,
    content_type character varying(100),
    file_size integer,
    document_guid character varying(50),
    status character varying(50) DEFAULT 'pending'::character varying,
    error_message text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: email_filing_attachments_attachment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.email_filing_attachments_attachment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: email_filing_attachments_attachment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.email_filing_attachments_attachment_id_seq OWNED BY public.email_filing_attachments.attachment_id;


--
-- Name: email_filing_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_filing_configs (
    config_id integer NOT NULL,
    user_id integer NOT NULL,
    instance_id integer NOT NULL,
    name character varying(255) NOT NULL,
    webhook_secret character varying(255) NOT NULL,
    default_folder_id integer,
    auto_extract_control_numbers boolean DEFAULT true,
    control_number_patterns text DEFAULT '\\b[A-Z]{2,4}[0-9]{6,10}\\b'::text,
    file_email_as_pdf boolean DEFAULT true,
    include_attachments boolean DEFAULT true,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: email_filing_configs_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.email_filing_configs_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: email_filing_configs_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.email_filing_configs_config_id_seq OWNED BY public.email_filing_configs.config_id;


--
-- Name: email_filing_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_filing_logs (
    log_id integer NOT NULL,
    config_id integer,
    instance_id integer,
    user_id integer,
    email_subject character varying(500),
    email_from character varying(255),
    email_to character varying(255),
    email_date timestamp with time zone,
    email_message_id character varying(255),
    control_numbers_found text[],
    control_number_used character varying(50),
    policy_guid character varying(50),
    quote_guid character varying(50),
    document_guid character varying(50),
    folder_id integer,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    error_message text,
    processing_attempts integer DEFAULT 0,
    email_body_text text,
    email_body_html text,
    attachments_count integer DEFAULT 0,
    processed_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    retry_after timestamp with time zone
);


--
-- Name: email_filing_logs_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.email_filing_logs_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: email_filing_logs_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.email_filing_logs_log_id_seq OWNED BY public.email_filing_logs.log_id;


--
-- Name: email_processing_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_processing_logs (
    id integer NOT NULL,
    instance_id integer,
    email_address character varying(255),
    message_id character varying(500),
    subject character varying(500),
    control_number character varying(50),
    processing_status character varying(50),
    error_message text,
    attachments_count integer DEFAULT 0,
    processed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    filed_to_ims boolean DEFAULT false,
    ims_document_guid character varying(100)
);


--
-- Name: email_processing_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.email_processing_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: email_processing_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.email_processing_logs_id_seq OWNED BY public.email_processing_logs.id;


--
-- Name: ims_instances_instance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ims_instances_instance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ims_instances_instance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ims_instances_instance_id_seq OWNED BY public.ims_instances.instance_id;


--
-- Name: ims_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ims_reports (
    report_id integer NOT NULL,
    instance_id integer,
    name character varying(255) NOT NULL,
    procedure_name character varying(255) NOT NULL,
    parameters jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: ims_reports_report_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ims_reports_report_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ims_reports_report_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ims_reports_report_id_seq OWNED BY public.ims_reports.report_id;


--
-- Name: monthly_usage_summaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.monthly_usage_summaries (
    summary_id integer NOT NULL,
    user_id integer NOT NULL,
    billing_month date NOT NULL,
    plan_id integer,
    emails_processed integer DEFAULT 0,
    emails_filed_successfully integer DEFAULT 0,
    emails_failed integer DEFAULT 0,
    webhook_calls integer DEFAULT 0,
    manual_filings integer DEFAULT 0,
    included_emails integer DEFAULT 0,
    overage_emails integer DEFAULT 0,
    base_charge numeric(10,2) DEFAULT 0,
    overage_charge numeric(10,2) DEFAULT 0,
    total_charge numeric(10,2) DEFAULT 0,
    is_final boolean DEFAULT false,
    generated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: monthly_usage_summaries_summary_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.monthly_usage_summaries_summary_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: monthly_usage_summaries_summary_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.monthly_usage_summaries_summary_id_seq OWNED BY public.monthly_usage_summaries.summary_id;


--
-- Name: reserved_subdomains; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reserved_subdomains (
    subdomain character varying(100) NOT NULL,
    reason character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: subscription_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_plans (
    plan_id integer NOT NULL,
    plan_name character varying(50) NOT NULL,
    plan_display_name character varying(100) NOT NULL,
    monthly_price numeric(10,2) NOT NULL,
    max_instances integer,
    monthly_email_limit integer,
    overage_price_per_email numeric(10,4) DEFAULT 0.06 NOT NULL,
    features jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: subscription_plans_plan_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subscription_plans_plan_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: subscription_plans_plan_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.subscription_plans_plan_id_seq OWNED BY public.subscription_plans.plan_id;


--
-- Name: system_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_config (
    key character varying(100) NOT NULL,
    value text,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: usage_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usage_events (
    event_id integer NOT NULL,
    user_id integer NOT NULL,
    instance_id integer,
    event_type character varying(50) NOT NULL,
    event_subtype character varying(50),
    quantity integer DEFAULT 1,
    metadata jsonb DEFAULT '{}'::jsonb,
    billable boolean DEFAULT true,
    billing_period_start date NOT NULL,
    billing_period_end date NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: usage_events_event_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usage_events_event_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usage_events_event_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usage_events_event_id_seq OWNED BY public.usage_events.event_id;


--
-- Name: user_quotas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_quotas (
    quota_id integer NOT NULL,
    user_id integer NOT NULL,
    quota_type character varying(50) NOT NULL,
    current_period_start date NOT NULL,
    current_period_end date NOT NULL,
    quota_limit integer,
    current_usage integer DEFAULT 0,
    last_reset_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: user_quotas_quota_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_quotas_quota_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_quotas_quota_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_quotas_quota_id_seq OWNED BY public.user_quotas.quota_id;


--
-- Name: user_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_subscriptions (
    subscription_id integer NOT NULL,
    user_id integer NOT NULL,
    plan_id integer NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    trial_ends_at timestamp with time zone,
    current_period_start timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    current_period_end timestamp with time zone NOT NULL,
    cancelled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: user_subscriptions_subscription_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_subscriptions_subscription_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_subscriptions_subscription_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_subscriptions_subscription_id_seq OWNED BY public.user_subscriptions.subscription_id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    user_id integer NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    full_name character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: users_user_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_user_id_seq OWNED BY public.users.user_id;


--
-- Name: billing_invoices invoice_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_invoices ALTER COLUMN invoice_id SET DEFAULT nextval('public.billing_invoices_invoice_id_seq'::regclass);


--
-- Name: email_configurations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_configurations ALTER COLUMN id SET DEFAULT nextval('public.email_configurations_id_seq'::regclass);


--
-- Name: email_filing_attachments attachment_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_filing_attachments ALTER COLUMN attachment_id SET DEFAULT nextval('public.email_filing_attachments_attachment_id_seq'::regclass);


--
-- Name: email_filing_configs config_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_filing_configs ALTER COLUMN config_id SET DEFAULT nextval('public.email_filing_configs_config_id_seq'::regclass);


--
-- Name: email_filing_logs log_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_filing_logs ALTER COLUMN log_id SET DEFAULT nextval('public.email_filing_logs_log_id_seq'::regclass);


--
-- Name: email_processing_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_processing_logs ALTER COLUMN id SET DEFAULT nextval('public.email_processing_logs_id_seq'::regclass);


--
-- Name: ims_instances instance_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ims_instances ALTER COLUMN instance_id SET DEFAULT nextval('public.ims_instances_instance_id_seq'::regclass);


--
-- Name: ims_reports report_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ims_reports ALTER COLUMN report_id SET DEFAULT nextval('public.ims_reports_report_id_seq'::regclass);


--
-- Name: monthly_usage_summaries summary_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_usage_summaries ALTER COLUMN summary_id SET DEFAULT nextval('public.monthly_usage_summaries_summary_id_seq'::regclass);


--
-- Name: subscription_plans plan_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans ALTER COLUMN plan_id SET DEFAULT nextval('public.subscription_plans_plan_id_seq'::regclass);


--
-- Name: usage_events event_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_events ALTER COLUMN event_id SET DEFAULT nextval('public.usage_events_event_id_seq'::regclass);


--
-- Name: user_quotas quota_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_quotas ALTER COLUMN quota_id SET DEFAULT nextval('public.user_quotas_quota_id_seq'::regclass);


--
-- Name: user_subscriptions subscription_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscriptions ALTER COLUMN subscription_id SET DEFAULT nextval('public.user_subscriptions_subscription_id_seq'::regclass);


--
-- Name: users user_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN user_id SET DEFAULT nextval('public.users_user_id_seq'::regclass);


--
-- Name: billing_invoices billing_invoices_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_invoices
    ADD CONSTRAINT billing_invoices_invoice_number_key UNIQUE (invoice_number);


--
-- Name: billing_invoices billing_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_invoices
    ADD CONSTRAINT billing_invoices_pkey PRIMARY KEY (invoice_id);


--
-- Name: email_configurations email_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_configurations
    ADD CONSTRAINT email_configurations_pkey PRIMARY KEY (id);


--
-- Name: email_filing_attachments email_filing_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_filing_attachments
    ADD CONSTRAINT email_filing_attachments_pkey PRIMARY KEY (attachment_id);


--
-- Name: email_filing_configs email_filing_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_filing_configs
    ADD CONSTRAINT email_filing_configs_pkey PRIMARY KEY (config_id);


--
-- Name: email_filing_configs email_filing_configs_user_id_instance_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_filing_configs
    ADD CONSTRAINT email_filing_configs_user_id_instance_id_name_key UNIQUE (user_id, instance_id, name);


--
-- Name: email_filing_configs email_filing_configs_webhook_secret_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_filing_configs
    ADD CONSTRAINT email_filing_configs_webhook_secret_key UNIQUE (webhook_secret);


--
-- Name: email_filing_logs email_filing_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_filing_logs
    ADD CONSTRAINT email_filing_logs_pkey PRIMARY KEY (log_id);


--
-- Name: email_processing_logs email_processing_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_processing_logs
    ADD CONSTRAINT email_processing_logs_pkey PRIMARY KEY (id);


--
-- Name: ims_instances ims_instances_email_subdomain_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ims_instances
    ADD CONSTRAINT ims_instances_email_subdomain_key UNIQUE (email_subdomain);


--
-- Name: ims_instances ims_instances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ims_instances
    ADD CONSTRAINT ims_instances_pkey PRIMARY KEY (instance_id);


--
-- Name: ims_reports ims_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ims_reports
    ADD CONSTRAINT ims_reports_pkey PRIMARY KEY (report_id);


--
-- Name: monthly_usage_summaries monthly_usage_summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_usage_summaries
    ADD CONSTRAINT monthly_usage_summaries_pkey PRIMARY KEY (summary_id);


--
-- Name: monthly_usage_summaries monthly_usage_summaries_user_id_billing_month_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_usage_summaries
    ADD CONSTRAINT monthly_usage_summaries_user_id_billing_month_key UNIQUE (user_id, billing_month);


--
-- Name: reserved_subdomains reserved_subdomains_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reserved_subdomains
    ADD CONSTRAINT reserved_subdomains_pkey PRIMARY KEY (subdomain);


--
-- Name: subscription_plans subscription_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_pkey PRIMARY KEY (plan_id);


--
-- Name: subscription_plans subscription_plans_plan_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_plan_name_key UNIQUE (plan_name);


--
-- Name: system_config system_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_config
    ADD CONSTRAINT system_config_pkey PRIMARY KEY (key);


--
-- Name: email_configurations unique_email_address; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_configurations
    ADD CONSTRAINT unique_email_address UNIQUE (email_address);


--
-- Name: usage_events usage_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_events
    ADD CONSTRAINT usage_events_pkey PRIMARY KEY (event_id);


--
-- Name: user_quotas user_quotas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_quotas
    ADD CONSTRAINT user_quotas_pkey PRIMARY KEY (quota_id);


--
-- Name: user_quotas user_quotas_user_id_quota_type_current_period_start_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_quotas
    ADD CONSTRAINT user_quotas_user_id_quota_type_current_period_start_key UNIQUE (user_id, quota_type, current_period_start);


--
-- Name: user_subscriptions user_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_pkey PRIMARY KEY (subscription_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- Name: idx_attachments_log_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attachments_log_id ON public.email_filing_attachments USING btree (log_id);


--
-- Name: idx_email_config_instance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_config_instance ON public.email_configurations USING btree (instance_id);


--
-- Name: idx_email_config_last_processed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_config_last_processed ON public.email_configurations USING btree (last_processed_timestamp);


--
-- Name: idx_email_config_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_config_type ON public.email_configurations USING btree (config_type);


--
-- Name: idx_email_filing_logs_config; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_filing_logs_config ON public.email_filing_logs USING btree (config_id);


--
-- Name: idx_email_filing_logs_control_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_filing_logs_control_number ON public.email_filing_logs USING btree (control_number_used);


--
-- Name: idx_email_filing_logs_processed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_filing_logs_processed_at ON public.email_filing_logs USING btree (processed_at);


--
-- Name: idx_email_filing_logs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_filing_logs_status ON public.email_filing_logs USING btree (status);


--
-- Name: idx_email_logs_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_logs_date ON public.email_processing_logs USING btree (processed_at);


--
-- Name: idx_email_logs_instance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_logs_instance ON public.email_processing_logs USING btree (instance_id);


--
-- Name: idx_email_logs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_logs_status ON public.email_processing_logs USING btree (processing_status);


--
-- Name: idx_instances_email_config; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_instances_email_config ON public.ims_instances USING gin (email_config);


--
-- Name: idx_invoices_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_due_date ON public.billing_invoices USING btree (due_date);


--
-- Name: idx_invoices_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_status ON public.billing_invoices USING btree (status);


--
-- Name: idx_invoices_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_user ON public.billing_invoices USING btree (user_id);


--
-- Name: idx_quotas_user_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotas_user_type ON public.user_quotas USING btree (user_id, quota_type);


--
-- Name: idx_unique_subdomain_prefix; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_unique_subdomain_prefix ON public.email_configurations USING btree (instance_id, email_prefix) WHERE (email_prefix IS NOT NULL);


--
-- Name: idx_usage_events_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_events_created ON public.usage_events USING btree (created_at);


--
-- Name: idx_usage_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_events_type ON public.usage_events USING btree (event_type, billable);


--
-- Name: idx_usage_events_user_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_events_user_period ON public.usage_events USING btree (user_id, billing_period_start, billing_period_end);


--
-- Name: idx_user_subscriptions_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_subscriptions_period ON public.user_subscriptions USING btree (current_period_start, current_period_end);


--
-- Name: idx_user_subscriptions_user_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_subscriptions_user_status ON public.user_subscriptions USING btree (user_id, status);


--
-- Name: email_filing_configs update_email_filing_configs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_email_filing_configs_updated_at BEFORE UPDATE ON public.email_filing_configs FOR EACH ROW EXECUTE FUNCTION public.update_email_filing_configs_updated_at();


--
-- Name: system_config update_system_config_timestamp_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_system_config_timestamp_trigger BEFORE UPDATE ON public.system_config FOR EACH ROW EXECUTE FUNCTION public.update_system_config_timestamp();


--
-- Name: user_subscriptions update_user_subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_subscriptions_updated_at BEFORE UPDATE ON public.user_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_user_subscriptions_updated_at();


--
-- Name: billing_invoices billing_invoices_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_invoices
    ADD CONSTRAINT billing_invoices_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: email_configurations email_configurations_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_configurations
    ADD CONSTRAINT email_configurations_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.ims_instances(instance_id);


--
-- Name: email_filing_attachments email_filing_attachments_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_filing_attachments
    ADD CONSTRAINT email_filing_attachments_log_id_fkey FOREIGN KEY (log_id) REFERENCES public.email_filing_logs(log_id) ON DELETE CASCADE;


--
-- Name: email_filing_configs email_filing_configs_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_filing_configs
    ADD CONSTRAINT email_filing_configs_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.ims_instances(instance_id) ON DELETE CASCADE;


--
-- Name: email_filing_configs email_filing_configs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_filing_configs
    ADD CONSTRAINT email_filing_configs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: email_filing_logs email_filing_logs_config_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_filing_logs
    ADD CONSTRAINT email_filing_logs_config_id_fkey FOREIGN KEY (config_id) REFERENCES public.email_filing_configs(config_id) ON DELETE SET NULL;


--
-- Name: email_filing_logs email_filing_logs_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_filing_logs
    ADD CONSTRAINT email_filing_logs_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.ims_instances(instance_id) ON DELETE SET NULL;


--
-- Name: email_filing_logs email_filing_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_filing_logs
    ADD CONSTRAINT email_filing_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE SET NULL;


--
-- Name: email_processing_logs email_processing_logs_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_processing_logs
    ADD CONSTRAINT email_processing_logs_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.ims_instances(instance_id);


--
-- Name: ims_instances ims_instances_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ims_instances
    ADD CONSTRAINT ims_instances_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: ims_reports ims_reports_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ims_reports
    ADD CONSTRAINT ims_reports_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.ims_instances(instance_id) ON DELETE SET NULL;


--
-- Name: monthly_usage_summaries monthly_usage_summaries_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_usage_summaries
    ADD CONSTRAINT monthly_usage_summaries_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(plan_id);


--
-- Name: monthly_usage_summaries monthly_usage_summaries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_usage_summaries
    ADD CONSTRAINT monthly_usage_summaries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: usage_events usage_events_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_events
    ADD CONSTRAINT usage_events_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.ims_instances(instance_id) ON DELETE SET NULL;


--
-- Name: usage_events usage_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_events
    ADD CONSTRAINT usage_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: user_quotas user_quotas_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_quotas
    ADD CONSTRAINT user_quotas_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: user_subscriptions user_subscriptions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(plan_id);


--
-- Name: user_subscriptions user_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

