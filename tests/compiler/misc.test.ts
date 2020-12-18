import { renderToString, snapshotTemplateCode, TestApp, trim } from "../helpers";

// -----------------------------------------------------------------------------
// misc
// -----------------------------------------------------------------------------

describe("misc", () => {
  test("global", () => {
    const app = new TestApp();
    const _calleeAsc = `<año t-att-falló="'agüero'" t-raw="0"/>`;
    const _calleeUsesFoo = `<span t-esc="foo">foo default</span>`;
    const _calleeAscToto = `<div t-raw="toto">toto default</div>`;
    const caller = `
        <div>
          <t t-foreach="[4,5,6]" t-as="value" t-key="value">
            <span t-esc="value"/>
            <t t-call="_callee-asc">
              <t t-call="_callee-uses-foo">
                  <t t-set="foo" t-value="'aaa'"/>
              </t>
              <t t-call="_callee-uses-foo"/>
              <t t-set="foo" t-value="'bbb'"/>
              <t t-call="_callee-uses-foo"/>
            </t>
          </t>
          <t t-call="_callee-asc-toto"/>
        </div>`;
    app.addTemplate("_callee-asc", _calleeAsc);
    app.addTemplate("_callee-uses-foo", _calleeUsesFoo);
    app.addTemplate("_callee-asc-toto", _calleeAscToto);
    app.addTemplate("caller", caller);

    snapshotTemplateCode(caller);
    snapshotTemplateCode(_calleeAscToto);
    snapshotTemplateCode(_calleeAsc);
    snapshotTemplateCode(_calleeUsesFoo);

    const result = trim(app.renderToString("caller"));
    const expected = trim(`
        <div>
          <span>4</span>
          <año falló="agüero">
            <span>aaa</span>
            <span>foo default</span>
            <span>bbb</span>
          </año>
  
          <span>5</span>
          <año falló="agüero">
            <span>aaa</span>
            <span>foo default</span>
            <span>bbb</span>
          </año>
  
          <span>6</span>
          <año falló="agüero">
            <span>aaa</span>
            <span>foo default</span>
            <span>bbb</span>
          </año>
  
          <div>toto default</div>
        </div>
      `);
    expect(result).toBe(expected);
  });

  test("complex template", () => {
    const template = `
      <div t-attf-class="batch_tile {{options.more? 'more' : 'nomore'}}">
        <div t-attf-class="card bg-{{klass}}-light">
          <div class="batch_header">
              <a t-attf-href="/runbot/batch/{{batch.id}}" t-attf-class="badge badge-{{batch.has_warning ? 'warning' : 'light'}}" title="View Batch">
                  <t t-esc="batch.formated_age"/>
                  <i class="fa fa-exclamation-triangle" t-if="batch.has_warning"/>
                  <i class="arrow fa fa-window-maximize"/>
              </a>
          </div>
          <t t-if="batch.state=='preparing'">
              <span><i class="fa fa-cog fa-spin fa-fw"/> preparing</span>
          </t>
          <div class="batch_slots">
              <t t-foreach="batch.slot_ids.filter(slot => slot.build_id.id and !slot.trigger_id.manual and (options.trigger_display[slot.trigger_id.id]))" t-as="slot" t-key="slot.id">
                  <SlotButton class="slot_container" slot="slot"/>
              </t>
              <div class="slot_filler" t-foreach="[1, 2, 3, 4]" t-as="x" t-key="x"/>
          </div>
          <div class="batch_commits">
              <div t-foreach="commit_links" t-as="commit_link" class="one_line" t-key="commit_link.id">
                  <a t-attf-href="/runbot/commit/{{commit_link.commit_id}}" t-attf-class="badge badge-light batch_commit match_type_{{commit_link.match_type}}">
                  <i class="fa fa-fw fa-hashtag" t-if="commit_link.match_type == 'new'" title="This commit is a new head"/>
                  <i class="fa fa-fw fa-link" t-if="commit_link.match_type == 'head'" title="This commit is an existing head from bundle branches"/>
                  <i class="fa fa-fw fa-code-fork" t-if="commit_link.match_type == 'base_match'" title="This commit is matched from a base batch with matching merge_base"/>
                  <i class="fa fa-fw fa-clock-o" t-if="commit_link.match_type == 'base_head'" title="This commit is the head of a base branch"/>
                  <t t-esc="commit_link.commit_dname"/>
                  </a>
                  <a t-att-href="'https://%s/commit/%s' % (commit_link.commit_remote_url, commit_link.commit_name)" class="badge badge-light" title="View Commit on Github"><i class="fa fa-github"/></a>
                  <span t-esc="commit_link.commit_subject"/>
              </div>
          </div>
        </div>
      </div>`;

    snapshotTemplateCode(template);
    const context = {
      options: { more: true },
      klass: "info",
      batch: {
        id: 3,
        has_warning: true,
        formated_age: "1 year",
        state: "preparing",
        slot_ids: [],
      },
      commit_links: [],
    };
    const expected = `<div class=\"batch_tile more\"><div class=\"card bg-info-light\"><div class=\"batch_header\"><a title=\"View Batch\" href=\"/runbot/batch/3\" class=\"badge badge-warning\">1 year<i class=\"fa fa-exclamation-triangle\"></i><i class=\"arrow fa fa-window-maximize\"></i></a></div><span><i class=\"fa fa-cog fa-spin fa-fw\"></i> preparing</span><div class=\"batch_slots\"><div class=\"slot_filler\"></div><div class=\"slot_filler\"></div><div class=\"slot_filler\"></div><div class=\"slot_filler\"></div></div><div class=\"batch_commits\"></div></div></div>`;
    expect(renderToString(template, context)).toBe(expected);
  });

  test("other complex template", () => {
    const template = `
        <div>
          <header>
              <nav class="navbar navbar-expand-md navbar-light bg-light">
                  <a t-attf-href="/runbot/{{project.slug}}">
                      <b style="color:#777;">
                          <t t-esc="project.name"/>
                      </b>
                  </a>
                  <button type="button" class="navbar-toggler" data-toggle="collapse" data-target="#top_menu_collapse">
                      <span class="navbar-toggler-icon"></span>
                  </button>
                  <div class="collapse navbar-collapse" id="top_menu_collapse" aria-expanded="false">
                      <ul class="nav navbar-nav ml-auto text-right" id="top_menu">
                          <li class="nav-item" t-foreach="projects" t-as="project" t-key="project.id">
                              <a class="nav-link" href="#" t-on-click="selectProject(project)">
                                  <t t-esc="project.name"/>
                              </a>
                          </li>
                              
                          <li class="nav-item divider"></li>
                          <t t-if="user">
                              <t t-if="user.public">
                                  <li class="nav-item dropdown">
                                      <b>
                                          <a class="nav-link" t-attf-href="/web/login?redirect=/">Login</a>
                                      </b>
                                  </li>
                              </t>
                              <t t-else="">
                                  <t t-if="nb_assigned_errors and nb_assigned_errors > 0">
                                      <li class="nav-item">
                                          <a href="/runbot/errors" class="nav-link text-danger" t-attf-title="You have {{nb_assigned_errors}} random bug assigned">
                                              <i class="fa fa-bug"/><t t-esc="nb_assigned_errors"/>
                                          </a>
                                      </li>
                                      <li class="nav-item divider"/>
                                  </t>
                                  <t t-elif="nb_build_errors and nb_build_errors > 0">
                                      <li class="nav-item">
                                          <a href="/runbot/errors" class="nav-link" title="Random Bugs"><i class="fa fa-bug"/></a>
                                      </li>
                                      <li class="nav-item divider"/>
                                  </t>
                                  <li class="nav-item dropdown">
                                      <a href="#" class="nav-link dropdown-toggle" data-toggle="dropdown">
                                          <b>
                                              <span t-esc=" user.name.length &gt; 25 ? user.namesubstring(0, 23) + '...' : user.name"/>
                                          </b>
                                      </a>
                                      <div class="dropdown-menu js_usermenu" role="menu">
                                          <a class="dropdown-item" id="o_logout" role="menuitem" t-attf-href="/web/session/logout?redirect=/">Logout</a>
                                          <a class="dropdown-item" role="menuitem" t-attf-href="/web">Web</a>
                                      </div>
                                  </li>
                              </t>
                          </t>
                      </ul>
                          
                      <div>
                          <div class="input-group input-group-sm">
                              <div class="input-group-prepend input-group-sm">
                                  <button class="btn btn-default fa fa-cog" t-on-click="toggleSettingsMenu" title="Settings"/>
                                  <button class="btn btn-default" t-on-click="toggleMore">
                                      More
                                  </button>
                                  <select t-if="categories and categories.length > 1" class="custom-select" name="category" id="category">
                                      <option t-foreach="categories" t-as="category" t-key="category.id" t-att-value="category.id" t-esc="category.name" t-att-selected="category.id==options.active_category_id"/>
                                  </select>
                              </div>
                              
                              <input class="form-control" type="text" placeholder="Search" aria-label="Search" name="search" t-att-value="search.value" t-on-keyup="updateFilter" t-on-change="updateFilter" t-ref="search_input"/>
                              <div class="input-group-append">
                                  <button class="btn btn-default fa fa-eraser" t-on-click="clearSearch"/>
                              </div>
                          </div>
                      </div>
                  </div>
              </nav>
          </header>
      
          <div class="container-fluid" t-ref="settings_menu">
              <div class="row">
                  <!--div class="form-group col-md-6">
                      <h5>Search options</h5>
                      <input class="form-control" type="text" name="default_search" id="default_search" t-att-checked="default_search" placeholder="Default search"/>
      
                      <h5>Display options</h5>
                      <div class="form-check">
                          <input class="form-check-input" type="checkbox" name="display_sticky"/>
                          <label class="form-check-label" for="display_sticky">Display sticky</label>
                      </div>
                      <div class="form-check">
                          <input class="form-check-input" type="checkbox" name="display_dev"/>
                          <label class="form-check-label" for="display_dev">Display dev</label>
                      </div>
                  </div-->
                  <div class="form-group col-md-6">
                      <h5>Triggers</h5>
                      <t t-if="triggers">
                          <t t-foreach="triggers" t-as="trigger" t-key="trigger.id">
                              <div t-if="!trigger.manual and trigger.project_id === project.id and trigger.category_id === options.active_category_id" class="form-check">
                                  <input class="form-check-input" type="checkbox" 
                                  t-attf-name="trigger_{{trigger.id}}" 
                                  t-attf-id="trigger_{{trigger.id}}" 
                                  t-att-checked="options.trigger_display[trigger.id]"
                                  t-att-data-trigger_id="trigger.id"
                                  t-on-change="updateTriggerDisplay"/>
                                  <label class="form-check-label" t-attf-for="trigger_{{trigger.id}}" t-esc="trigger.name"/>
                              </div>
                          </t>
                          <div>
                              <button class="btn btn-sm btn-default" t-on-click="triggerAll">All</button>
                              <button class="btn btn-sm btn-default" t-on-click="triggerNone">None</button>
                              <button class="btn btn-sm btn-info" t-on-click="triggerDefault">Default</button>
                              <button class="btn btn-sm btn-default" t-on-click="toggleSettingsMenu">Close</button>
                          </div>
                      </t>
                  </div>
              </div>
          </div>
      
          <div class="container-fluid frontend">
              <div class="row">
                  <div class='col-md-12'>
                      <t t-call="LOAD_INFOS_TEMPLATE" t-if="load_infos"/>
                  </div>
                  <div class='col-md-12'>
                      <div t-if="message" class="alert alert-warning" role="alert">
                          <t t-esc="message" /> <!-- todo fixme-->
                      </div>
                      <div t-if="! project" class="mb32">
                          <h1>No project</h1>
                      </div>
                      <div t-else="">
                          <BundlesList bundles="bundles.sticky" category_custom_views="category_custom_views" search="search"/>
                          <BundlesList bundles="bundles.dev" search="search"/>
                      </div>
                  </div>
              </div>
          </div>
      </div>`;

    snapshotTemplateCode(template);
  });
});
