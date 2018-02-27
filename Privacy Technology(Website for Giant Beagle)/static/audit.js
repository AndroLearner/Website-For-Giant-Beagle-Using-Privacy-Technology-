(function () {
  $.get({
    url: '/authorization',
  }).then(function(result) {
    var levels = {
      'aggregation': 0,
      'aggregation+firstname+lastname+address+zip': 1,
      'aggregation+firstname+lastname+address+zip+gender+age': 2,
      'aggregation+firstname+lastname+address+zip+gender+age+diseases+prescriptions': 3,
    };
    var countByLevel = [0, 0, 0, 0];
    var customerCount = 0;
    var changed = 0;
    var changesById = {};
    var lastLevelById = {};
    var countByAgeGroup = [];
    result.forEach(function (authorization) {
      var id = authorization.id;
      if (id in changesById) {
        if (changesById[id] === 0) {
          changed += 1;
        }
        countByLevel[lastLevelById[id]] -= 1;
        changesById[id] += 1;
      } else {
        customerCount += 1;
        changesById[id] = 0;
        var ageGroup = Math.floor(authorization.customer.age / 10);
        while (countByAgeGroup.length <= ageGroup) {
          countByAgeGroup.push(0);
        }
        countByAgeGroup[ageGroup] += 1;
      }
      var level = levels[authorization.authorized_fields];
      lastLevelById[id] = level;
      countByLevel[level] += 1;
    });
    $('.js-id-count-estimation').text(customerCount);
    var changesCount = {};
    var changeTimes = [];
    for (var id in changesById) {
      var times = changesById[id];
      if (!changesCount[times]) {
        changesCount[times] = 1;
        changeTimes.push(times);
      } else {
        changesCount[times] += 1;
      }
    }
    changeTimes.sort(function (a, b) { return a - b;});
    var changeValues = changeTimes.map(function (times) {
      return changesCount[times];
    });
    var chart = new Chart($('.js-chart-1'), {
      type: 'pie',
      data: {
        labels: [
          'No Personal Information',
          'Contact Information',
          'General Information',
          'Medical Information',
        ],
        datasets: [
          {
            data: countByLevel,
            backgroundColor: [
              '#FF6384',
              '#36A2EB',
              '#CC65FE',
              '#FFCE56',
            ],
            hoverBackgroundColor: [
              '#FF6384',
              '#36A2EB',
              '#CC65FE',
              '#FFCE56',
            ]
          }
        ]
      },
      options: {
        title: {
          display: true,
          text: 'Authorized Information of Customers'
        },
        legend: {
          position: 'bottom',
        },
      },
    });
    var chart = new Chart($('.js-chart-2'), {
      type: 'pie',
      data: {
        labels: changeTimes.map(function (times) {
          if (times === 0) return 'Unchanged';
          if (times === 1) return 'Changed once';
          if (times === 2) return 'Changed twice';
          return 'Changed ' + times + ' times';
        }),
        datasets: [
          {
            data: changeValues,
            backgroundColor: [
              '#FF6384',
              '#36A2EB',
              '#CC65FE',
              '#FFCE56',
            ],
            hoverBackgroundColor: [
              '#FF6384',
              '#36A2EB',
              '#CC65FE',
              '#FFCE56',
            ]
          }
        ]
      },
      options: {
        title: {
          display: true,
          text: 'Customers Changing Sharing Settings',
        },
        legend: {
          position: 'bottom',
        },
      },
    });
    var chart = new Chart($('.js-chart-3'), {
      type: 'pie',
      data: {
        labels: countByAgeGroup.map(function (_, i) {
          if (i === 0) return '< 10';
          if (i === countByAgeGroup.length - 1) return '> ' + (i * 10 + 9);
          return (i * 10) + '-' + (i * 10 + 9);
        }),
        datasets: [
          {
            data: countByAgeGroup,
            backgroundColor: countByAgeGroup.map(function (_, i) {
              return 'hsl(' + (360 * i / countByAgeGroup.length) + ', 80%, 70%)';
            }),
          }
        ]
      },
      options: {
        title: {
          display: true,
          text: 'Enrolled Customer Age Distribution',
        },
        legend: {
          position: 'bottom',
        },
      },
    });
    $('.js-loading-stats').hide();
    $('.js-cloak-stats').css('opacity', 1);
  });
  $.get({
    url: '/complaints',
  }).then(function(result) {
    if (result.length === 0) {
      $('.js-loading-complaints').hide();
      $('.js-cloak-complaints').css('opacity', 1);
      $('.js-cloak-complaints').text('There are no complaints right now.');
      return;
    }
    var typeCount = [0, 0, 0, 0];
    var types = {
      "inaccurate_data": 0,
      "wrong_advertising": 1,
      "user_interface_issues": 2,
      "other": 3,
    };
    var classForType = [
      'danger',
      'warning',
      'info',
      'default'
    ];
    var labelForType = [
      'Inaccurate Data',
      'Wrong Advertising',
      'Issues with the website',
      'Other',
    ];
    result.forEach(function (complaint) {
      typeCount[types[complaint.complaint_type]] += 1;
    });
    var template = $('.js-complaint-template').remove().clone();
    for (var i = 0; i < 5 && i < result.length; i++) {
      var complaint = result[result.length - 1 - i];
      var complaintEl = template.clone();
      var klass = classForType[types[complaint.complaint_type]];
      var label = labelForType[types[complaint.complaint_type]];
      complaintEl.addClass('panel-' + klass);
      complaintEl.find('.js-complaint-type').addClass('label-' + klass).text(label);
      complaintEl.find('.js-complaint-details').text(complaint.complaint_details);
      complaintEl.find('.js-desired-outcome').text(complaint.desired_outcome);
      var name = complaint.customer.firstname + ' ' + complaint.customer.lastname;
      complaintEl.find('.js-name').text(name);
      complaintEl.find('.js-reply').attr('href', 'mailto:' + complaint.email);
      var date = new Date(complaint.created_at);
      complaintEl.find('.js-date').text(date.toLocaleDateString());
      complaintEl.appendTo('.js-complaint-list');
    }

    var chart = new Chart($('.js-chart-complaints'), {
      type: 'pie',
      data: {
        labels: labelForType,
        datasets: [
          {
            data: typeCount,
            backgroundColor: [
              '#d9534f',
              '#d58512',
              '#31b0d5',
              '#cccccc',
            ],
          }
        ]
      },
      options: {
        title: {
          display: true,
          text: 'Complaints by Type'
        },
        legend: {
          position: 'left',
        },
      },
    });
    $('.js-loading-complaints').hide();
    $('.js-cloak-complaints').css('opacity', 1);
  });
  $.get({
    url: '/exports',
  }).then(function(result) {
    $('.js-loading-exports').hide();
    result.forEach(addExportRow);
  });
  var exportTemplate = $('.js-export-template').remove().clone();
  function addExportRow(exp) {
    var exportEl = exportTemplate.clone();
    var date = new Date(exp.created_at);
    exportEl.find('.js-datetime').text(date.toLocaleString());
    exportEl.find('.js-purpose').text(exp.purpose);
    exportEl.find('.js-partner').text(exp.partner);
    exportEl.find('.js-id-count').text(exp.id_rows);
    exportEl.find('.js-deid-count').text(exp.deid_rows);
    exportEl.find('.js-download-link').attr('href', exp.url);
    exportEl.appendTo('.js-export-list');
    return exportEl;
  }
  var exportAction = $('.js-export-action');
  exportAction.on('click', function(e) {
    e.preventDefault();
    exportAction.attr('disabled', 'disabled');
    var body = {
      purpose: $('.js-purpose-input')[0].value,
      partner: $('.js-partner-input')[0].value,
    };
    jQuery.post({
      url: '/exports',
      contentType : 'application/json',
      data: JSON.stringify(body),
    }).then(function(result) {
      var exportEl = addExportRow(result);
      var link = exportEl.find('.js-download-link');
      link.removeClass('btn-default');
      link.addClass('btn-primary');

      link.text('Download Ready!');
      $('.js-partner-input').val('');
      alert('Your data set is ready! Please check the last row in Exports.');
    }).catch(function() {
      alert('Network Error! Please try again.');
    }).always(function() {
      exportAction.removeAttr('disabled');
    });
    alert('Generating data set... This can take about a minute. Please do not leave this page.');
  });
})();
