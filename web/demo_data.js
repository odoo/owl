(function(window) {
  "use strict";

  var menus = [
    {
      id: 96,
      name: "Discuss",
      parent_id: false,
      action: "ir.actions.client,131",
      icon: "fa fa-comment",
      children: [
        {
          id: 97,
          name: "Integrations",
          parent_id: 96,
          action: false,
          icon: false,
          children: [
            {
              id: 188,
              name: "Github Repositories",
              parent_id: 97,
              action: "ir.actions.act_window,233",
              icon: false,
              children: []
            }
          ]
        }
      ]
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
})(window);
