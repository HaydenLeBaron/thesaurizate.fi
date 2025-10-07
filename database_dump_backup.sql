--
-- PostgreSQL database dump
--

\restrict hTZaXvulUy9RCgMmmpxdq1gSgIKId97GLAHBA8C3pVAqzJYqkPkt0nYhbvXnfKa

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.transactions DROP CONSTRAINT IF EXISTS transactions_source_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.transactions DROP CONSTRAINT IF EXISTS transactions_destination_user_id_fkey;
ALTER TABLE IF EXISTS ONLY private.failed_transactions DROP CONSTRAINT IF EXISTS failed_transactions_source_user_id_fkey;
ALTER TABLE IF EXISTS ONLY private.failed_transactions DROP CONSTRAINT IF EXISTS failed_transactions_destination_user_id_fkey;
DROP INDEX IF EXISTS public.idx_transactions_user_balance;
DROP INDEX IF EXISTS public.idx_transactions_source;
DROP INDEX IF EXISTS public.idx_transactions_dest;
DROP INDEX IF EXISTS private.idx_failed_transactions_source_user;
DROP INDEX IF EXISTS private.idx_failed_transactions_idempotency_key;
DROP INDEX IF EXISTS private.idx_failed_transactions_failed_at;
DROP INDEX IF EXISTS private.idx_failed_transactions_destination_user;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE IF EXISTS ONLY public.transactions DROP CONSTRAINT IF EXISTS transactions_pkey;
ALTER TABLE IF EXISTS ONLY public.transactions DROP CONSTRAINT IF EXISTS transactions_idempotency_key_key;
ALTER TABLE IF EXISTS ONLY public.pgmigrations DROP CONSTRAINT IF EXISTS pgmigrations_pkey;
ALTER TABLE IF EXISTS ONLY private.failed_transactions DROP CONSTRAINT IF EXISTS failed_transactions_pkey;
ALTER TABLE IF EXISTS public.pgmigrations ALTER COLUMN id DROP DEFAULT;
DROP TABLE IF EXISTS public.users;
DROP TABLE IF EXISTS public.transactions;
DROP SEQUENCE IF EXISTS public.pgmigrations_id_seq;
DROP TABLE IF EXISTS public.pgmigrations;
DROP TABLE IF EXISTS private.failed_transactions;
DROP FUNCTION IF EXISTS public.get_current_balance(p_user_id uuid);
DROP FUNCTION IF EXISTS public.get_balance_on_date(p_user_id uuid, p_date timestamp with time zone);
DROP EXTENSION IF EXISTS "uuid-ossp";
DROP SCHEMA IF EXISTS private;
--
-- Name: private; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA private;


ALTER SCHEMA private OWNER TO postgres;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: get_balance_on_date(uuid, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_balance_on_date(p_user_id uuid, p_date timestamp with time zone) RETURNS numeric
    LANGUAGE sql STABLE PARALLEL SAFE
    AS $$
    SELECT COALESCE(SUM(
        CASE
            WHEN source_user_id = p_user_id THEN -amount
            WHEN destination_user_id = p_user_id THEN amount
            ELSE 0
        END
    ), 0)
    FROM transactions
    WHERE (source_user_id = p_user_id OR destination_user_id = p_user_id)
        AND created_at <= p_date;
$$;


ALTER FUNCTION public.get_balance_on_date(p_user_id uuid, p_date timestamp with time zone) OWNER TO postgres;

--
-- Name: get_current_balance(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_current_balance(p_user_id uuid) RETURNS numeric
    LANGUAGE sql STABLE PARALLEL SAFE
    AS $$
    SELECT public.get_balance_on_date(p_user_id, NOW());
$$;


ALTER FUNCTION public.get_current_balance(p_user_id uuid) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: failed_transactions; Type: TABLE; Schema: private; Owner: postgres
--

CREATE TABLE private.failed_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    idempotency_key uuid NOT NULL,
    source_user_id uuid,
    destination_user_id uuid,
    amount integer NOT NULL,
    error_message text NOT NULL,
    retry_count integer DEFAULT 0 NOT NULL,
    failed_at timestamp with time zone DEFAULT now() NOT NULL,
    addressed_at timestamp with time zone,
    CONSTRAINT different_users CHECK (((source_user_id IS NULL) OR (source_user_id <> destination_user_id))),
    CONSTRAINT failed_transactions_amount_check CHECK ((amount > 0))
);


ALTER TABLE private.failed_transactions OWNER TO postgres;

--
-- Name: pgmigrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pgmigrations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    run_on timestamp without time zone NOT NULL
);


ALTER TABLE public.pgmigrations OWNER TO postgres;

--
-- Name: pgmigrations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pgmigrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pgmigrations_id_seq OWNER TO postgres;

--
-- Name: pgmigrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pgmigrations_id_seq OWNED BY public.pgmigrations.id;


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transactions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    idempotency_key uuid NOT NULL,
    source_user_id uuid,
    destination_user_id uuid NOT NULL,
    amount numeric(19,4) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT transactions_amount_check CHECK ((amount > (0)::numeric))
);


ALTER TABLE public.transactions OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: pgmigrations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pgmigrations ALTER COLUMN id SET DEFAULT nextval('public.pgmigrations_id_seq'::regclass);


--
-- Data for Name: failed_transactions; Type: TABLE DATA; Schema: private; Owner: postgres
--

COPY private.failed_transactions (id, idempotency_key, source_user_id, destination_user_id, amount, error_message, retry_count, failed_at, addressed_at) FROM stdin;
\.


--
-- Data for Name: pgmigrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pgmigrations (id, name, run_on) FROM stdin;
1	20251006202559187_create-transactions-system	2025-10-06 21:27:04.098223
3	20251007005016874_private-schema	2025-10-07 00:52:31.018852
4	20251007005017000_failed-transactions	2025-10-07 00:52:31.018852
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.transactions (id, idempotency_key, source_user_id, destination_user_id, amount, created_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, password_hash, created_at, updated_at) FROM stdin;
\.


--
-- Name: pgmigrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.pgmigrations_id_seq', 4, true);


--
-- Name: failed_transactions failed_transactions_pkey; Type: CONSTRAINT; Schema: private; Owner: postgres
--

ALTER TABLE ONLY private.failed_transactions
    ADD CONSTRAINT failed_transactions_pkey PRIMARY KEY (id);


--
-- Name: pgmigrations pgmigrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pgmigrations
    ADD CONSTRAINT pgmigrations_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_failed_transactions_destination_user; Type: INDEX; Schema: private; Owner: postgres
--

CREATE INDEX idx_failed_transactions_destination_user ON private.failed_transactions USING btree (destination_user_id);


--
-- Name: idx_failed_transactions_failed_at; Type: INDEX; Schema: private; Owner: postgres
--

CREATE INDEX idx_failed_transactions_failed_at ON private.failed_transactions USING btree (failed_at DESC);


--
-- Name: idx_failed_transactions_idempotency_key; Type: INDEX; Schema: private; Owner: postgres
--

CREATE INDEX idx_failed_transactions_idempotency_key ON private.failed_transactions USING btree (idempotency_key);


--
-- Name: idx_failed_transactions_source_user; Type: INDEX; Schema: private; Owner: postgres
--

CREATE INDEX idx_failed_transactions_source_user ON private.failed_transactions USING btree (source_user_id);


--
-- Name: idx_transactions_dest; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_dest ON public.transactions USING btree (destination_user_id, created_at);


--
-- Name: idx_transactions_source; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_source ON public.transactions USING btree (source_user_id, created_at);


--
-- Name: idx_transactions_user_balance; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_user_balance ON public.transactions USING btree (source_user_id, destination_user_id, created_at, amount);


--
-- Name: failed_transactions failed_transactions_destination_user_id_fkey; Type: FK CONSTRAINT; Schema: private; Owner: postgres
--

ALTER TABLE ONLY private.failed_transactions
    ADD CONSTRAINT failed_transactions_destination_user_id_fkey FOREIGN KEY (destination_user_id) REFERENCES public.users(id);


--
-- Name: failed_transactions failed_transactions_source_user_id_fkey; Type: FK CONSTRAINT; Schema: private; Owner: postgres
--

ALTER TABLE ONLY private.failed_transactions
    ADD CONSTRAINT failed_transactions_source_user_id_fkey FOREIGN KEY (source_user_id) REFERENCES public.users(id);


--
-- Name: transactions transactions_destination_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_destination_user_id_fkey FOREIGN KEY (destination_user_id) REFERENCES public.users(id);


--
-- Name: transactions transactions_source_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_source_user_id_fkey FOREIGN KEY (source_user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict hTZaXvulUy9RCgMmmpxdq1gSgIKId97GLAHBA8C3pVAqzJYqkPkt0nYhbvXnfKa

