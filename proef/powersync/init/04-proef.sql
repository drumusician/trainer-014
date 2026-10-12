-- Alleen voor de proef: wat PowerSync van de database vraagt, en twee trainers.
create publication powersync for all tables;
create database powersync_opslag;

insert into auth.users (id, email) values
  ('44444444-4444-4444-4444-444444444444', 'anna@voorbeeld.nl'),
  ('55555555-5555-5555-5555-555555555555', 'bas@voorbeeld.nl');
