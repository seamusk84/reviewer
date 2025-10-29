// pages/index.tsx
import * as React from "react";
import Head from "next/head";
import { supabase } from "../lib/supabaseClient";

/** Types */
type County = { id: string; name: string };
type Town = { id: string; name: string; county_id: string };
type Estate = { id: string; name: string; town_id: string };
type Review = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
  estate_id: string;
};

/** -------------------------
 * Utilities
 * ------------------------*/
const slug = (s: string) =>
  s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const WHOLE_TOWN_ESTATE_NAME = "Whole town";

/** CSV tiny parser (no quotes support needed for our simple files) */
async function fetchCSV(path: string): Promise<string[][]> {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) return [];
  const text = await res.text();
  return text
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => row.split(",").map((c) => c.trim()));
}

/** Map county name -> id (slug), keep canonical name list of 32 */
const COUNTY_LIST: County[] = [
  "Antrim","Armagh","Carlow","Cavan","Clare","Cork","Derry","Donegal","Down","Dublin",
  "Fermanagh","Galway","Kerry","Kildare","Kilkenny","Laois","Leitrim","Limerick","Longford",
  "Louth","Mayo","Meath","Monaghan","Offaly","Roscommon","Sligo","Tipperary","Tyrone",
  "Waterford","Westmeath","Wexford","Wicklow",
].map((name) => ({ id: slug(name), name }));

const COUNTY_BY_NAME = new Map(COUNTY_LIST.map((c) => [c.name.toLowerCase(), c.id]));

/** -------------------------
 * Fallback loaders from /public/data
 * - places.csv      expected columns: Town, County  (header row allowed)
 * - estates.csv     expected columns: Estate, Town  (header row allowed)
 * ------------------------*/
async function loadTownsFromCSV(countyId: string): Promise<Town[]> {
  try {
    const rows = await fetchCSV("/data/places.csv");
    if (!rows.length) return [];
    // Skip header if present
