(function(window) {
  "use strict";

  var menus = [
    {
      id: 96,
      name: "Discuss",
      parent_id: false,
      action: "ir.actions.client,131",
      icon: "fa fa-comment",
      children: []
    },
    {
      id: 205,
      name: "Notes",
      parent_id: false,
      action: "ir.actions.act_window,250",
      icon: "fa fa-pen",
      children: []
    },
    {
      id: 409,
      name: "CRM",
      parent_id: false,
      action: "ir.actions.act_window,597",
      icon: "fa fa-handshake",
      children: [
        {
          id: 418,
          name: "Sales",
          parent_id: 409,
          action: false,
          icon: false,
          children: [
            {
              id: 423,
              name: "My Pipeline",
              parent_id: 418,
              action: "ir.actions.act_window,597",
              icon: false,
              children: []
            },
            {
              id: 812,
              name: "My Quotations",
              parent_id: 418,
              action: "ir.actions.act_window,1051",
              icon: false,
              children: []
            },
            {
              id: 419,
              name: "Team Pipelines",
              parent_id: 418,
              action: "ir.actions.act_window,275",
              icon: false,
              children: []
            }
          ]
        },
        {
          id: 421,
          name: "Leads",
          parent_id: 409,
          action: false,
          icon: false,
          children: [
            {
              id: 422,
              name: "Leads",
              parent_id: 421,
              action: "ir.actions.act_window,595",
              icon: false,
              children: []
            },
            {
              id: 752,
              name: "Scoring Rules",
              parent_id: 421,
              icon: false,
              action: "ir.actions.act_window,1083",
              children: []
            }
          ]
        }
      ]
    }
  ];
  window.demoData = {
    menus: menus
  };

  const actions = [
    {
      id: 131,
      type: "ir.actions.client",
      target: "current",
      name: "Discuss",
      tag: "mail.discuss"
    },
    {
      id: 250,
      type: "ir.actions.act_window",
      name: "Notes",
      target: "current",
      domain: false,
      context: "{}",
      views: [[false, "kanban"], [false, "list"], [false, "form"]],
      res_id: 0,
      res_model: "note.note"
    },
    {
      id: 597,
      type: "ir.actions.act_window",
      name: "Pipeline",
      target: "current",
      domain: false,
      context: { default_team_id: 1 },
      views: [[2103, "kanban"], [2106, "list"], [2105, "form"]],
      res_id: 0,
      res_model: "crm.lead"
    },
    {
      id: 1051,
      type: "ir.actions.act_window",
      name: "Quotations",
      target: "current",
      domain: false,
      context: "{'search_default_my_quotation': 1}",
      views: [
        [3387, "list"],
        [3385, "kanban"],
        [3389, "form"],
        [3382, "calendar"],
        [3384, "pivot"],
        [3383, "graph"]
      ],
      res_id: 0,
      res_model: "sale.order"
    },
    {
      id: 275,
      type: "ir.actions.act_window",
      name: "Team Pipelines",
      target: "current",
      context: "{}",
      domain: "[('use_opportunities', '=', True)]",
      views: [[false, "kanban"], [false, "form"]],
      res_id: 0,
      res_model: "crm.team"
    },
    {
      id: 595,
      type: "ir.actions.act_window",
      name: "Leads",
      target: "current",
      context:
        "{ 'default_type':'lead', 'search_default_type': 'lead', 'search_default_to_process':1,  }",
      domain: "['|', ('type','=','lead'), ('type','=',False)]",
      views: [
        [2098, "list"],
        [2099, "kanban"],
        [2100, "calendar"],
        [2108, "pivot"],
        [2107, "graph"],
        [false, "form"]
      ],
      res_id: 0,
      res_model: "crm.lead"
    },
    {
      id: 1083,
      type: "ir.actions.act_window",
      name: "Scores",
      target: "current",
      context: "{}",
      domain: false,
      views: [[false, "list"], [false, "kanban"], [false, "form"]],
      res_id: 0,
      res_model: "website.crm.score"
    }
  ];

  window.demoData.mockAjax = async function(route, params) {
    console.log("RPC", route, params);

    // wait some random delay
    const delay = Math.random() * 1000;
    await new Promise(resolve => setTimeout(resolve, delay));

    // mock action
    if (route === "web/action/load") {
      const action = actions.find(a => a.id === params.action_id);
      if (action) {
        return action;
      } else {
        throw new Error("cannot find action");
      }
    }
    // unknown route
    console.warn("Unknown route", route);
    return true;
  };
})(window);
