import * as owl from "../../src";
import { Component, props, proxy, types as t, xml } from "../../src";
import { addSetup, LOCALE_TEMPLATE, makeTestData, randCountry, randLanguage } from "../utils";

const LOCALE_SCHEMA = t.object({
  locale: t.string,
  language: t.object({
    name: t.string,
    name_local: t.string,
    iso_639_1: t.string,
    iso_639_2: t.string,
    iso_639_3: t.string,
    countries: t.array(
      t.object({
        name: t.string,
        name_local: t.string,
        code: t.string,
      })
    ),
  }),
  country: t.object({
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
    languages: t.array(
      t.object({
        name: t.string,
        name_local: t.string,
        iso_639_1: t.string,
        iso_639_2: t.string,
        iso_639_3: t.string,
      })
    ),
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
  }),
});

class Locale extends Component {
  static override template = xml`${LOCALE_TEMPLATE}`;

  props = props({
    // values: LOCALE_SCHEMA,
    values: t.object(),
  });

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
      <t t-foreach="this.props.list" t-as="values" t-key="values.locale">
        <Locale values="values" />
      </t>
    </div>
  `;

  props = props({
    list: t.array(),
    // list: t.array(LOCALE_SCHEMA),
  });

  append() {
    this.props.list.push(makeTestData());
  }

  prepend() {
    this.props.list.unshift(makeTestData());
  }
}

addSetup("Owl 3 (state)", {
  owl,
  Root,
  parseProps(data) {
    return {
      list: proxy(data),
    };
  },
});
