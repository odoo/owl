import type * as owlCurrent from "@odoo/owl";
import type * as owlNext from "../src";
import { LOCALES } from "./data";

type TestData = typeof LOCALES;

type Country = Partial<TestData[number]["country"]> &
  TestData[number]["language"]["countries"][number] & {
    languages: Language[];
  };
type Language = Partial<TestData[number]["language"]> &
  TestData[number]["country"]["languages"][number] & {
    countries: Country[];
  };

export interface OwlSetup<
  T extends typeof owlNext | typeof owlCurrent = typeof owlNext | typeof owlCurrent
> {
  owl: T;
  Root: T["Component"];
  parseProps?: (data: TestData) => any;
}

export interface BenchmarkCase {
  label: string;
  setup?: (owlSetup: OwlSetup, data?: TestData) => any;
  run: (owlSetup: OwlSetup, data?: TestData) => any;
}

function inputModel(id: keyof typeof config) {
  const input = document.getElementById(id) as HTMLInputElement;
  const isCheckbox = input.getAttribute("type") === "checkbox";
  const searchParamKey = input.getAttribute("name")!;
  if (url.searchParams.has(searchParamKey)) {
    config[id] = Number(url.searchParams.get(searchParamKey)) || 0;
  }
  if (isCheckbox) {
    input.checked = !!config[id];
  } else {
    input.value = String(config[id]);
  }

  input.addEventListener("input", () => {
    const value = Number(isCheckbox ? input.checked : input.value) || 0;
    config[id] = value;
    url.searchParams.set(searchParamKey, String(value));
    history.replaceState({}, "", url.toString());
  });
}

const CONSONANTS = "bcdfghjklmnpqrstvwxz".split("");
const VOWELS = "aeiouy".split("");
const CHARS = [...CONSONANTS, ...VOWELS];
const COUNTRY_SUFFIX = ["istan", "stan", "land", "ica"];
const CONTINENTS = ["Africa", "America", "Antarctica", "Asia", "Europe", "Oceania"];
const LANGUAGE_SUFFIX = ["ish", "ic", "ian"];

const owlSetups: [label: string, setup: OwlSetup][] = [];
const benchmarkCases: BenchmarkCase[] = [];

const buttonsContainer = document.getElementById("render-buttons") as HTMLDivElement;
const url = new URL(window.location.toString());
const config = {
  dataSize: 0,
  duration: 5,
  mergeData: 0,
  warmupSampleSize: 3,
};

inputModel("dataSize");
inputModel("duration");
inputModel("mergeData");

let currentComponent: any = null;

export function addSetup(label: string, owlSetup: OwlSetup) {
  owlSetups.push([label, owlSetup]);

  const button = document.createElement("button");
  button.className = "btn btn-sm btn-outline-primary text-nowrap";
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", async () => {
    await cleanup(currentComponent);
    const { owl, parseProps, Root } = owlSetup;
    const data = getSampleData();
    currentComponent = await owl.mount(Root, fixture, {
      dev: true,
      props: parseProps?.(data) ?? data,
    });
  });
  buttonsContainer.appendChild(button);
}

export function addBenchmark(benchmarkCase: BenchmarkCase) {
  benchmarkCases.push(benchmarkCase);
}

export async function cleanup(comp?: any) {
  if (comp?.__owl__?.app) {
    comp.__owl__.app.destroy();
    fixture.innerHTML = "";
  }
  await new Promise((resolve) => setTimeout(resolve, 1));
  await new Promise(requestAnimationFrame);
}

export function choose<T>(list: T[]) {
  return list[randInt(list.length)]!;
}

export function floor(n: number, rounding: number = 0) {
  const mult = 10 ** rounding;
  return Math.floor(n * mult) / mult;
}

export function getConfig() {
  return config;
}

export function getSetups() {
  return owlSetups;
}

export function getBenchmarkCases() {
  return benchmarkCases;
}

export function getSampleData() {
  const slice = config.dataSize ? LOCALES.slice(0, config.dataSize) : LOCALES;
  const copy = JSON.parse(JSON.stringify(slice));
  if (config.mergeData) {
    for (const locale of copy) {
      function mergeCountry(country: Country) {
        if (allCountries[country.code]) {
          return Object.assign(allCountries[country.code]!, country);
        }
        allCountries[country.code] = country;
        return country;
      }

      function mergeLanguage(language: Language) {
        if (allLanguages[language.name]) {
          return Object.assign(allLanguages[language.name]!, language);
        }
        allLanguages[language.name] = language;
        return language;
      }

      const allCountries: Record<string, Country> = {};
      const allLanguages: Record<string, Language> = {};

      locale.country = mergeCountry(locale.country);
      const locCountries = locale.language.countries;
      for (let i = 0; i < locCountries.length; i++) {
        locCountries[i] = mergeCountry(locCountries[i]);
      }
      locale.language = mergeLanguage(locale.language);
      const locLanguages = locale.country.languages;
      for (let i = 0; i < locLanguages.length; i++) {
        locLanguages[i] = mergeLanguage(locLanguages[i]);
      }
    }
  }
  return copy;
}

export function hashHas(value: string) {
  return url.hash.includes(value);
}

export function insertInList(sortedList: number[], value: number) {
  const n = sortedList.length;
  for (let i = 0; i < n; i++) {
    if (value < sortedList[i]!) {
      sortedList.splice(i, 0, value);
      break;
    }
  }
  sortedList.push(value);
}

export function setHash(value: string) {
  url.hash = value;
  history.replaceState({}, "", url.toString());
}

export function makeTestData() {
  const country = randCountry();
  const language = randLanguage();
  country.languages.push(language);
  language.countries.push(country);

  const nLanguages = randInt(9);
  for (let i = 0; i < nLanguages; i++) {
    const otherLanguage = randLanguage();
    country.languages.push(otherLanguage);
    otherLanguage.countries.push(country);
  }

  const nCountries = randInt(5);
  for (let i = 0; i < nCountries; i++) {
    const otherCountry = randCountry();
    language.countries.push(otherCountry);
    otherCountry.languages.push(language);
  }

  const locale = language.iso_639_1 + "-" + country.code;
  return { locale, language, country };
}

export function randBool() {
  return Math.random() < 0.5;
}

export function randCountry(...languages: Language[]) {
  const name = title(randString(randInt(3, 6)) + choose(COUNTRY_SUFFIX));
  if (!config.mergeData) {
    languages = languages.map((language) => ({ ...language }));
  }
  return {
    flag: "🤓",
    name,
    code: name.slice(0, 2).toUpperCase(),
    area_sq_km: randInt(100, 100_000),
    continent: choose(CONTINENTS),
    languages,
  } as Country;
}

export function randFloat(start: number, end?: number) {
  if (!end) {
    end = start;
    start = 0;
  }
  return Math.random() * (end - start) + start;
}

export function randInt(start: number, end?: number) {
  return Math.floor(randFloat(start, end));
}

export function randLanguage(...countries: Country[]) {
  const name = title(randString(randInt(3, 8))) + choose(LANGUAGE_SUFFIX);
  const nameShort = name.slice(0, 3).toLowerCase();
  if (!config.mergeData) {
    countries = countries.map((country) => ({ ...country }));
  }
  return {
    name: name,
    name_local: name,
    iso_639_1: nameShort,
    iso_639_2: nameShort,
    iso_639_3: nameShort,
    countries,
  } as Language;
}

export function randString(length: number) {
  let string = "";
  let consCount = 0;
  for (let i = 0; i < length; i++) {
    const list = consCount === 2 || (consCount === 1 && randBool()) ? VOWELS : CHARS;
    const nextChar = choose(list);
    if (list === VOWELS || VOWELS.includes(nextChar)) {
      consCount = 0;
    } else {
      consCount++;
    }
    string += nextChar;
  }
  return string;
}

export function ratio(min: number, max: number) {
  return Math.floor((1 - min / max) * 100);
}

export function removeHighestInList(sortedList: number[], max: number) {
  let index = -1;
  for (let i = sortedList.length - 1; i >= 0; i--) {
    if (sortedList[i]! < max) {
      index = i + 1;
      break;
    }
  }
  if (index < 0) {
    return 0;
  }
  return sortedList.splice(index).length;
}

export function sum(numbers: Iterable<number>) {
  let total = 0;
  for (const n of numbers) {
    total += n;
  }
  return total;
}

export function title(string: string) {
  return string[0]?.toUpperCase() + string.slice(1);
}

export function waitForMutation() {
  const { promise, resolve } = Promise.withResolvers();
  const observer = new MutationObserver(function onMutation() {
    if (handle) {
      cancelAnimationFrame(handle);
    }
    handle = requestAnimationFrame(() => {
      observer.disconnect();
      resolve();
    });
  });
  let handle = 0;
  observer.observe(document.body, {
    attributes: true,
    childList: true,
    subtree: true,
  });
  return promise;
}

export class SortedList {
  list: number[] = [];

  *[Symbol.iterator]() {
    for (const n of this.list) {
      yield n;
    }
  }

  get length() {
    return this.list.length;
  }

  average() {
    return sum(this.list) / this.list.length;
  }

  insert(...values: number[]) {
    for (const value of values) {
      const n = this.list.length;
      for (let i = 0; i < n; i++) {
        if (value < this.list[i]!) {
          this.list.splice(i, 0, value);
          break;
        }
      }
      this.list.push(value);
    }
  }

  median() {
    return this.list[Math.floor(this.list.length / 2)] || 0;
  }

  removeHighestThan(max: number) {
    let index = -1;
    for (let i = this.list.length - 1; i >= 0; i--) {
      if (this.list[i]! < max) {
        index = i + 1;
        break;
      }
    }
    if (index < 0) {
      return [];
    }
    return this.list.splice(index);
  }

  shift() {
    return this.list.shift();
  }

  unshift(value: number) {
    this.list.unshift(value);
  }
}

export const LOCALE_TEMPLATE = /* xml */ `
  <div class="card w-25">
    <t t-set="loc" t-value="this.props.values" />
    <div class="card-body">
      <h2 class="card-title fw-bold" t-out="loc.locale"></h2>
    </div>
    <section class="card-body">
      <h3 class="card-title">
        Language: <strong t-out="loc.language.name" />
      </h3>
      <p class="card-text">List of speaking countries:</p>
      <ul class="list-group mb-3">
        <t t-foreach="this.getCountries() or []" t-as="country" t-key="country.code">
          <li class="list-group-item">
              <t t-out="country.name" /> (<t t-out="country.code" />)
          </li>
        </t>
      </ul>
      <button class="btn btn-primary" t-on-click="this.addCountry">
        Add country
      </button>
    </section>
    <section class="card-body">
      <h3 class="card-title">
        Country: <strong t-out="loc.country.name" /> <t t-out="loc.country.flag" />
      </h3>
      <p class="card-text">
        Area: <t t-out="loc.country.area_sq_km" />
        <br />
        Continent: <t t-out="loc.country.continent" />
        <br />
        <t t-if="loc.country.is_landlocked">
          Landlocked
        </t>
        <t t-else="">
          Open to sea
        </t>
      </p>
      <p class="card-text">List of languages:</p>
      <ul class="list-group mb-3">
        <t t-foreach="this.getLanguages() or []" t-as="language" t-key="language.name">
          <li class="list-group-item" t-out="language.name" />
        </t>
      </ul>
      <button class="btn btn-primary" t-on-click="this.addLanguage">
        Add language
      </button>
    </section>
  </div>
`;

export const fixture = document.getElementById("fixture") as HTMLDivElement;
