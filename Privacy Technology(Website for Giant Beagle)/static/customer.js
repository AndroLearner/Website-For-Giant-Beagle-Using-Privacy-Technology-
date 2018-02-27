(function () {
  function handleRoute() {
    switch (location.hash) {
      case '#/enroll':
        if (!authenticated()) {
          showLogin('Enroll');
        } else {
          location.hash = '#/sharing';
        }
        break;
      case '#/sharing':
        if (!authenticated()) {
          showLogin('Please log in to change your sharing settings.');
        } else {
          showSharing();
        }
        break;
      case '#/my':
        if (!authenticated()) {
          showLogin('Please log in to view your health information.');
        } else {
          showMyInfo();
        }
        break;
      case '#/complaint':
        if (!authenticated()) {
          showLogin('Please log in to file a complaint.');
        } else {
          showComplaint();
        }
        break;
      case '#/login':
        if (authenticated()) {
          location.hash = '#/sharing';
        } else {
          showLogin('Customer Login');
        }
        break;
      default:
        showHome();
        break;
    }
    var activeEls = $('.js-route-active');
    activeEls.removeClass('active');
    activeEls.first().addClass('active');
    activeEls.each(function (_, el) {
      var e = $(el);
      if (e.find('a').attr('href') === location.hash) {
        activeEls.first().removeClass('active');
        e.addClass('active');
        return false;
      }
    });
  }

  function showLogin(prompt) {
    $('.js-route').hide();
    $('.js-login-prompt').text(prompt);
    $('.js-route.js-route-login').show();
    $('.js-sign-in-form input').val('');
    $('.js-verify-password-form input').val('');
    $('.js-new-user').val('');
    $('.js-sign-in-form').show();
    $('.js-verify-password-form').hide();
  }

  function loginRedirect() {
    if (location.hash === '#/my') {
      showMyInfo();
    } else if (location.hash === '#/complaint') {
      showComplaint();
    } else {
      location.hash = '#/sharing';
    }
  }

  function showHome() {
    $('.js-route').hide();
    $('.js-route.js-route-home').show();
  }

  function showMyInfo() {
    $('.js-route').hide();
    $('.js-route.js-route-my').show();
    var token = localStorage['authorization_token'];
    $('.js-download-phi').attr('href', '/download/phi?token=' + token);
    $('.js-download-shared-id').attr('href',
      '/download/generated_data?token=' + token);
    $('.js-download-shared-deid').attr('href',
      '/download/generated_data_deid?token=' + token);
  }

  function showSharing(result) {
    if (!result && $('.js-route.js-route-sharing').css('display') === 'block') {
      return;
    }
    $('.js-route').hide();
    $('.js-route.js-route-sharing').show();
    if (typeof result === 'object') {
      $('.js-new-user').hide();
      $('.js-new-user input').removeAttr('required');
      var fields = result.authorized_fields;
      var input = $('input[name="authorized_fields"][value="' + fields + '"]');
      if (input.length) input[0].checked = true;
      $('.js-loading').hide();
      $('.js-join-form').show();
    } else if (result === 'new') {
      $('.js-new-user').show();
      $('.js-new-user input').attr('required', 'required');
      $('.js-loading').hide();
      $('.js-join-form').show();
    } else {
      jQuery.post({
        url: '/authorization/query',
        contentType : 'application/json',
        data: JSON.stringify({
          authorization_token: localStorage['authorization_token'],
        }),
      }).then(function(result) {
        if ($('.js-route.js-route-sharing').css('display') === 'block') {
          showSharing(result);
        }
      }).catch(function (err) {
        alert('Network Error! Please try again.');
      });
    }
  }

  function showComplaint() {
    $('.js-route').hide();
    $('.js-route.js-route-complaint').show();
  }

  function authenticated() {
    return !!localStorage['authorization_token'];
  }

  function onAuthSuccess(result) {
    localStorage['authorization_token'] = result.token;
    localStorage['greeting'] = 'Hi, ' + result.customer.firstname + ' ' +
      result.customer.lastname + '!';
    $('.js-greeting').text(localStorage['greeting']);
    $('.js-greeting, .js-sign-out').show();
    $('.js-sign-in').hide();
  }

  $(window).on('hashchange', handleRoute);
  $('.js-sign-out').on('click', function (e) {
    e.preventDefault();
    delete localStorage['authorization_token'];
    delete localStorage['greeting'];
    location.hash = '';
    $('.js-greeting, .js-sign-out').hide();
    $('.js-sign-in').show();
  });
  handleRoute();
  if (authenticated()) {
    $('.js-greeting').text(localStorage['greeting']);
    $('.js-greeting, .js-sign-out').show();
    $('.js-sign-in').hide();
  }

  function getFormValues(form) {
    var body = {};
    var fields = form.elements;
    for (var i = 0, l = fields.length; i < l; i++) {
      if (!fields[i].name) continue;
      if (fields[i].type === 'radio' && !fields[i].checked) continue;
      body[fields[i].name] = fields[i].value;
    }
    console.log(body);
    return body;
  }

  $('.js-sign-in-form').on('submit', function(e) {
    e.preventDefault();
    $('.js-submit').attr('disabled', 'disabled');
    $('.js-form-error').hide();
    var body = getFormValues(this);
    jQuery.post({
      url: '/customers/query',
      contentType : 'application/json',
      data: JSON.stringify(body),
    }).then(function(result) {
      if (!result.exists) {
        $('.js-form-error.js-not-found').show();
      } else {
        if (result.authorized) {
          $('.js-verify-password-form').show();
        } else {
          showSharing('new');
          return;
        }
        $('.js-sign-in-form').hide();
      }
      $('.js-submit').removeAttr('disabled');
    }).catch(function () {
      alert('Network Error! Please try again.');
    }).always(function() {
      $('.js-submit').removeAttr('disabled');
    });
  });
  $('.js-verify-password-form').on('submit', function(e) {
    e.preventDefault();
    $('.js-submit').attr('disabled', 'disabled');
    $('.js-form-error').hide();
    var body = getFormValues(this);
    jQuery.extend(body, getFormValues($('.js-sign-in-form')[0]));
    jQuery.post({
      url: '/authorization/query',
      contentType : 'application/json',
      data: JSON.stringify(body),
    }).then(function(result) {
      onAuthSuccess(result);
      loginRedirect();
    }).catch(function (err) {
      if (err.status === 403) {
        $('.js-form-error.js-incorrect-password').show();
        return;
      }
      alert('Network Error! Please try again.');
    }).always(function() {
      $('.js-submit').removeAttr('disabled');
    });
  });
  $('.js-join-form').on('submit', function(e) {
    e.preventDefault();
    $('.js-submit').attr('disabled', 'disabled');
    $('.js-form-error').hide();
    var body = getFormValues(this);
    if (authenticated()) {
      body.authorization_token = localStorage['authorization_token'];
    } else {
      if (body.passwordConfirm !== body.password) {
        $('.js-form-error.js-confirm-password').show();
        $('.js-submit').removeAttr('disabled');
        return;
      } else {
        delete body.passwordConfirm;
        jQuery.extend(body, getFormValues($('.js-sign-in-form')[0]));
      }
    }
    jQuery.post({
      url: '/authorization',
      contentType : 'application/json',
      data: JSON.stringify(body),
    }).then(function(result) {
      onAuthSuccess(result);
      if (body.password) {
        alert('You have successfully signed up for Healthier Choices!');
      } else {
        alert('You have successfully changed your sharing preferences!');
      }
      loginRedirect();
    }).catch(function () {
      alert('Network Error! Please try again.');
    }).always(function() {
      $('.js-submit').removeAttr('disabled');
    });
  });
  $('.js-complaint-form').on('submit', function(e) {
    e.preventDefault();
    $('.js-submit').attr('disabled', 'disabled');
    $('.js-form-error').hide();
    var body = getFormValues(this);
    if ('password' in body) {
      if (body.passwordConfirm !== body.password) {
        $('.js-form-error.js-confirm-password').show();
        $('.js-submit').removeAttr('disabled');
        return;
      } else {
        delete body.passwordConfirm;
        jQuery.extend(body, getFormValues($('.js-sign-in-form')[0]));
      }
    } else {
      body.authorization_token = localStorage['authorization_token'];
    }
    jQuery.post({
      url: '/complaints',
      contentType : 'application/json',
      data: JSON.stringify(body),
    }).then(function(result) {
      alert('Your complaint has been recorded. We will contact you soon.');
      location.hash = '#/';
    }).catch(function () {
      alert('Network Error! Please try again.');
    }).always(function() {
      $('.js-submit').removeAttr('disabled');
    });
  });
  $('.navbar-toggle').on('click', function() {
    $('.navbar-collapse').toggleClass('collapse');
  });
})();
