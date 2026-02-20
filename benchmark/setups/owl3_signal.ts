import * as owl from "../../src";
import { Component, props, signal, types as t, xml } from "../../src";
import type { LOCALES } from "../data";
import { addSetup, LOCALE_TEMPLATE, makeTestData, randCountry, randLanguage } from "../utils";

function addSignalToLocale(locale: typeof LOCALES[number]) {
  const isCountriesSignal = typeof locale.language.countries === "function";
  const isLanguagesSignal = typeof locale.country.languages === "function";
  if (isCountriesSignal && isLanguagesSignal) {
    return locale;
  }
  const copy = { ...locale };
  if (!isCountriesSignal) {
    copy.language = {
      ...copy.language,
      countries: signal.Array(copy.language.countries),
    };
  }
  if (!isLanguagesSignal) {
    copy.country = {
      ...copy.country,
      languages: signal.Array(copy.country.languages),
    };
  }
  return copy;
}

const COUNTRY_SHEMA = {
  name: t.string,
  name_local: t.string,
  code: t.string,
  area_sq_km: t.number,
  continent: t.string,
  region: t.string,
  capital_name: t.string,
  "capital_latitude?": t.number,
  "capital_longitude?": t.number,
  currency: t.string,
  currency_local: t.string,
  currency_code: t.string,
  currency_symbol: t.string,
  currency_numeric: t.number,
  currency_subunit_value: t.number,
  currency_subunit_name: t.string,
  flag: t.string,
  timezones: t.array(t.string),
  borders: t.array(t.string),
  is_landlocked: t.boolean,
  postal_code_format: t.string,
  postal_code_regex: t.string,
  iso_3166_1_numeric: t.number,
  iso_3166_1_alpha2: t.string,
  iso_3166_1_alpha3: t.string,
  tld: t.string,
  vehicle_code: t.string,
  fips10: t.string,
  un_locode: t.string,
  stanag_1059: t.string,
  ioc: t.string,
  fifa: t.string,
  itu: t.string,
  uic: t.string,
  maritime: t.or([t.number, t.string]),
  mmc: t.or([t.number, t.string]),
};

const LANGUAGE_SCHEMA = {
  name: t.string,
  name_local: t.string,
  iso_639_1: t.string,
  iso_639_2: t.string,
  iso_639_3: t.string,
};

COUNTRY_SHEMA.languages = t.function([], t.array(t.object(LANGUAGE_SCHEMA)));
LANGUAGE_SCHEMA.countries = t.function([], t.array(t.object(COUNTRY_SHEMA)));

const LOCALE_SCHEMA = t.object({
  locale: t.string,
  language: t.object(LANGUAGE_SCHEMA),
  country: t.object(COUNTRY_SHEMA),
});

class Locale extends Component {
  static override template = xml`${LOCALE_TEMPLATE}`;

  props = props({
    values: t.object(),
    // values: LOCALE_SCHEMA,
  });

  addCountry() {
    const country = randCountry(this.props.values.language);
    this.props.values.language.countries().push(country);
  }

  addLanguage() {
    const language = randLanguage(this.props.values.country);
    this.props.values.country.languages().push(language);
  }

  getCountries() {
    return this.props.values.language.countries();
  }

  getLanguages() {
    return this.props.values.country.languages();
  }
}

class Root extends Component {
  static components = { Locale };
  static override template = xml`
    <div class="btn-group w-25 p-3">
      <button class="btn btn-primary" t-on-click="this.prepend">
        Prepend
      </button>
      <button class="btn btn-primary" t-on-click="this.append">
        Append
      </button>
    </div>
    <div class="Root d-flex flex-wrap p-3">
      <t t-foreach="this.props.list()" t-as="values" t-key="values.locale">
        <Locale values="values" />
      </t>
    </div>
  `;

  props = props({
    list: t.function([], LOCALE_SCHEMA),
  });

  append() {
    this.props.list().push(addSignalToLocale(makeTestData()));
  }

  prepend() {
    this.props.list().unshift(addSignalToLocale(makeTestData()));
  }
}

addSetup("Owl 3 (signal)", {
  owl,
  Root,
  parseProps(data) {
    return {
      list: signal.Array(data.map((locale) => addSignalToLocale(locale))),
    };
  },
});
