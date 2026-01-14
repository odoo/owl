import * as owl from "@odoo/owl";
import { Component, useState, xml } from "@odoo/owl";
import type { LOCALES } from "../data";
import { addSetup, LOCALE_TEMPLATE, makeTestData, randCountry, randLanguage } from "../utils";

const LANGUAGE_SCHEMA: any = {
  type: Object,
};
const COUNTRY_SCHEMA: any = {
  type: Object,
};

COUNTRY_SCHEMA.shape = {
  name: String,
  name_local: String,
  code: String,
  area_sq_km: Number,
  continent: String,
  region: String,
  capital_name: String,
  capital_latitude: { type: Number, optional: true },
  capital_longitude: { type: Number, optional: true },
  currency: String,
  currency_local: String,
  currency_code: String,
  currency_symbol: String,
  currency_numeric: Number,
  currency_subunit_value: Number,
  currency_subunit_name: String,
  languages: { type: Array, element: LANGUAGE_SCHEMA },
  flag: String,
  timezones: { type: Array, element: String },
  borders: { type: Array, element: String },
  is_landlocked: Boolean,
  postal_code_format: String,
  postal_code_regex: String,
  iso_3166_1_numeric: Number,
  iso_3166_1_alpha2: String,
  iso_3166_1_alpha3: String,
  tld: String,
  vehicle_code: String,
  fips10: String,
  un_locode: String,
  stanag_1059: String,
  ioc: String,
  fifa: String,
  itu: String,
  uic: String,
  maritime: Number,
  mmc: Number,
};
LANGUAGE_SCHEMA.shape = {
  name: String,
  name_local: String,
  iso_639_1: String,
  iso_639_2: String,
  iso_639_3: String,
  countries: { type: Array, element: COUNTRY_SCHEMA },
};

const LOCALE_SCHEMA = {
  locale: String,
  language: LANGUAGE_SCHEMA,
  country: COUNTRY_SCHEMA,
};

class Locale extends Component {
  static override props = {
    values: {
      type: Object,
      // shape: LOCALE_SCHEMA,
    },
  };
  static override template = xml`${LOCALE_TEMPLATE}`;

  addCountry() {
    const country = randCountry(this.props.values.language);
    this.props.values.language.countries.push(country);
  }

  addLanguage() {
    const language = randLanguage(this.props.values.country);
    this.props.values.country.languages.push(language);
  }

  getCountries() {
    return this.props.values.language.countries;
  }

  getLanguages() {
    return this.props.values.country.languages;
  }
}

class Root extends Component {
  static components = { Locale };
  static override props = {
    list: {
      type: Array,
      // element: LOCALE_SCHEMA,
    },
  };
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
      <t t-foreach="this.list" t-as="values" t-key="values.locale">
        <Locale values="values" />
      </t>
    </div>
  `;

  list!: typeof LOCALES;

  override setup() {
    this.list = useState(this.props.list);
  }

  append() {
    this.list.push(makeTestData());
  }

  prepend() {
    this.list.unshift(makeTestData());
  }
}

addSetup("Owl 2 (reactive)", {
  owl,
  Root,
  parseProps(data) {
    return {
      list: owl.reactive(data),
    };
  },
});
