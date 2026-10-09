/**
 * app.js
 * ---------------------------------------------------------------------------
 * PROG2002 Web Development II - Assessment 3
 * Charity Event website - AngularJS application
 *
 * The whole front-end (client website AND admin website) is an AngularJS 1.8.3
 * application. All pages share this single module which provides:
 *
 *   - an `apiService`  : a thin $http wrapper around the RESTful API that
 *                        normalises the { success, data } response envelope and
 *                        turns failures into readable Error objects
 *   - reusable filters : auDate / auCurrency / statusClass / shortDate
 *   - reusable directives : <event-card> and <registration-table>
 *   - one controller per page (client + admin)
 *
 * Every page is bootstrapped with ng-app="charityApp" and declares its own
 * ng-controller, so the same module is reused across the multi-page website.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';

  angular
    .module('charityApp', [])

    // Allow the API to live on a different origin after deployment
    // (set window.API_BASE in a page or in a small config script if needed).
    .constant('API_BASE', window.API_BASE || '')

    // =======================================================================
    // Services
    // =======================================================================

    /**
     * Read the query string of the current page (?id=...). $location cannot be
     * used for this because the project keeps the default (hashbang) routing,
     * where $location.search() only reads parameters placed after the hash.
     */
    .factory('queryParams', ['$window', function ($window) {
      var params = {};
      var search = String($window.location.search || '').replace(/^\?/, '');
      search.split('&').forEach(function (pair) {
        if (!pair) return;
        var parts = pair.split('=');
        params[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1] || '');
      });
      return params;
    }])

    /**
     * Thin wrapper around $http for the Charity Event API.
     * Every method resolves with the response body and rejects with
     * new Error('readable message').
     */
    .factory('apiService', ['$http', '$q', 'API_BASE', function ($http, $q, API_BASE) {
      function request(method, path, body) {
        return $http({
          method: method,
          url: API_BASE + path,
          data: body
        }).then(function (response) {
          // The API always answers with { success, data } or { success:false, message }.
          if (response.data && response.data.success === false) {
            return $q.reject(new Error(response.data.message || 'The request could not be completed.'));
          }
          return response.data;
        }, function (response) {
          var message = (response.data && response.data.message)
            || ('Request failed with status ' + response.status + '.');
          return $q.reject(new Error(message));
        });
      }

      return {
        get: function (path) { return request('GET', path); },
        post: function (path, body) { return request('POST', path, body); },
        put: function (path, body) { return request('PUT', path, body); },
        remove: function (path) { return request('DELETE', path); }
      };
    }])

    // =======================================================================
    // Filters
    // =======================================================================

    /** Format a database datetime as a readable local date/time. */
    .filter('auDate', function () {
      return function (value) {
        if (!value) return '-';
        var d = new Date(value);
        if (isNaN(d.getTime())) return String(value);
        return d.toLocaleString('en-AU', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });
      };
    })

    /** Format only the date portion (used by the weather outlook). */
    .filter('shortDate', function () {
      return function (value) {
        if (!value) return '-';
        var d = new Date(value);
        if (isNaN(d.getTime())) return String(value);
        return d.toLocaleDateString('en-AU', { weekday: 'short', day: '2-digit', month: 'short' });
      };
    })

    /** Format a number as Australian dollars. */
    .filter('auCurrency', function () {
      return function (value) {
        var n = Number(value || 0);
        return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };
    })

    /** CSS class for the event status badge (Active / Past / Suspended). */
    .filter('statusClass', function () {
      return function (status) {
        if (status === 'Active') return 'badge badge-active';
        if (status === 'Past') return 'badge badge-past';
        return 'badge badge-suspended';
      };
    })

    // =======================================================================
    // Directives (reusable UI components)
    // =======================================================================

    /** <event-card event="evt" weather="weatherByEvent[evt.event_id]"> */
    .directive('eventCard', function () {
      return {
        restrict: 'E',
        scope: { event: '=', weather: '=?' },
        template: [
          '<div class="event-card">',
          '  <h3>{{ event.event_title }}</h3>',
          '  <p>',
          '    <span class="badge badge-category">{{ event.category_name }}</span>',
          '    <span ng-class="event.event_status | statusClass" ng-if="event.event_status">{{ event.event_status }}</span>',
          '  </p>',
          '  <p><strong>Date:</strong> {{ event.event_date | auDate }}</p>',
          '  <p><strong>Location:</strong> {{ event.location }}</p>',
          '  <p><strong>Tickets:</strong>',
          '    <span ng-if="event.ticket_price > 0">{{ event.ticket_price | auCurrency }} each</span>',
          '    <span ng-if="event.ticket_price <= 0">Free entry</span>',
          '  </p>',
          '  <p class="weather-chip" ng-if="weather">',
          '    <span class="weather-chip-icon">{{ weather.icon }}</span>',
          '    <span>{{ weather.temp_min }}&deg;C &ndash; {{ weather.temp_max }}&deg;C &middot; {{ weather.description }}</span>',
          '    <span ng-if="weather.precipitation_probability !== null"> &middot; {{ weather.precipitation_probability }}% rain</span>',
          '  </p>',
          '  <div class="card-actions">',
          '    <a class="btn btn-primary" ng-href="event-detail.html?id={{ event.event_id }}">View Details</a>',
          '  </div>',
          '</div>'
        ].join('\n')
      };
    })

    /** <registration-table registrations="vm.registrations"> */
    .directive('registrationTable', function () {
      return {
        restrict: 'E',
        scope: { registrations: '=' },
        template: [
          '<div class="empty-state" ng-if="!registrations || registrations.length === 0">',
          '  No registrations have been recorded for this event yet.',
          '</div>',
          '<div class="table-wrap" ng-if="registrations && registrations.length">',
          '  <table class="data-table">',
          '    <thead><tr>',
          '      <th>ID</th><th>Name</th><th>Email</th><th>Phone</th>',
          '      <th>Tickets</th><th>Total</th><th>Registered</th><th>Status</th>',
          '    </tr></thead>',
          '    <tbody>',
          '      <tr ng-repeat="r in registrations track by r.registration_id">',
          '        <td>#{{ r.registration_id }}</td>',
          '        <td>{{ r.attendee_name }}</td>',
          '        <td>{{ r.attendee_email }}</td>',
          '        <td>{{ r.contact_phone }}</td>',
          '        <td>{{ r.tickets_purchased }}</td>',
          '        <td>{{ r.total_amount | auCurrency }}</td>',
          '        <td>{{ r.registration_date | auDate }}</td>',
          '        <td>{{ r.registration_status }}</td>',
          '      </tr>',
          '    </tbody>',
          '  </table>',
          '</div>'
        ].join('\n')
      };
    })

    // =======================================================================
    // Client-side controllers
    // =======================================================================

    /** Home page: upcoming events + a weather chip on each card. */
    .controller('HomeController', ['apiService', function (apiService) {
      var vm = this;
      vm.events = [];
      vm.weatherByEvent = {};
      vm.loading = true;
      vm.error = '';

      function loadWeather() {
        return apiService.get('/api/weather/upcoming').then(function (result) {
          angular.forEach(result.data, function (summary) {
            vm.weatherByEvent[summary.event_id] = summary;
          });
        }).catch(function () {
          // The weather API is optional - ignore failures silently.
        });
      }

      vm.load = function () {
        vm.loading = true;
        vm.error = '';
        apiService.get('/api/events/upcoming').then(function (result) {
          vm.events = result.data;
          vm.loading = false;
          loadWeather();
        }).catch(function (err) {
          vm.error = err.message;
          vm.loading = false;
        });
      };

      vm.load();
    }])

    /** Search page: category / location / date / keyword filters. */
    .controller('SearchController', ['apiService', function (apiService) {
      var vm = this;
      vm.categories = [];
      // The date filter must start as null: an input[type=date] bound to an
      // empty string makes the AngularJS date directive log a model error.
      vm.filters = { categoryId: '', location: '', date: null, keyword: '' };
      vm.events = [];
      vm.weatherByEvent = {};
      vm.searched = false;
      vm.loading = false;
      vm.error = '';
      vm.validationError = '';

      apiService.get('/api/categories').then(function (result) {
        vm.categories = result.data;
      }).catch(function (err) {
        vm.error = 'Could not load categories: ' + err.message;
      });

      function formatDateInput(value) {
        if (!value) return '';
        if (value instanceof Date) {
          var month = String(value.getMonth() + 1).padStart(2, '0');
          var day = String(value.getDate()).padStart(2, '0');
          return value.getFullYear() + '-' + month + '-' + day;
        }
        return String(value);
      }

      vm.search = function () {
        vm.validationError = '';
        vm.error = '';

        var location = (vm.filters.location || '').trim();
        if (location.length === 1) {
          vm.validationError = 'Please type at least 2 characters for the location.';
          return;
        }

        var query = [];
        if (vm.filters.categoryId) query.push('categoryId=' + encodeURIComponent(vm.filters.categoryId));
        if (location) query.push('location=' + encodeURIComponent(location));
        if (vm.filters.date) query.push('date=' + encodeURIComponent(formatDateInput(vm.filters.date)));
        if (vm.filters.keyword) query.push('keyword=' + encodeURIComponent(vm.filters.keyword.trim()));

        vm.loading = true;
        vm.searched = true;
        apiService.get('/api/events/search?' + query.join('&')).then(function (result) {
          vm.events = result.data;
          vm.loading = false;
        }).catch(function (err) {
          vm.error = err.message;
          vm.events = [];
          vm.loading = false;
        });
      };

      vm.clear = function () {
        vm.filters = { categoryId: '', location: '', date: null, keyword: '' };
        vm.events = [];
        vm.searched = false;
        vm.validationError = '';
        vm.error = '';
      };

      // Show all events when the page first opens.
      vm.search();
    }])

    /** Event details page: event, registrations and the weather forecast. */
    .controller('EventDetailController', ['apiService', 'queryParams', function (apiService, queryParams) {
      var vm = this;
      vm.eventId = queryParams.id;
      vm.event = null;
      vm.registrations = [];
      vm.weather = null;
      vm.weatherMessage = '';
      vm.loading = true;
      vm.error = '';
      vm.progressPercent = 0;

      vm.load = function () {
        if (!vm.eventId || isNaN(Number(vm.eventId))) {
          vm.error = 'No valid event id was supplied.';
          vm.loading = false;
          return;
        }

        apiService.get('/api/events/' + vm.eventId).then(function (result) {
          vm.event = result.data;
          vm.registrations = result.data.registrations || [];
          var goal = Number(vm.event.fundraising_goal) || 0;
          vm.progressPercent = goal > 0
            ? Math.min((Number(vm.event.current_progress) / goal) * 100, 100)
            : 0;
          vm.loading = false;
          vm.loadWeather();
        }).catch(function (err) {
          vm.error = err.message;
          vm.loading = false;
        });
      };

      vm.loadWeather = function () {
        apiService.get('/api/events/' + vm.eventId + '/weather').then(function (result) {
          vm.weather = result.data;
        }).catch(function (err) {
          vm.weatherMessage = err.message;
        });
      };

      vm.load();
    }])

    /** Registration page: collect the attendee details and create a record. */
    .controller('RegisterController', ['apiService', 'queryParams', '$timeout',
      function (apiService, queryParams, $timeout) {
        var vm = this;
        vm.eventId = queryParams.id;
        vm.event = null;
        vm.loading = true;
        vm.error = '';
        vm.successMessage = '';
        vm.submitting = false;
        vm.registrationOpen = false;

        // Pre-filled with the current date/time so the user only has to confirm.
        vm.form = {
          attendee_name: '',
          attendee_email: '',
          contact_phone: '',
          tickets_purchased: 1,
          registration_date: new Date()
        };

        vm.totalAmount = function () {
          var price = vm.event ? Number(vm.event.ticket_price) || 0 : 0;
          var tickets = Number(vm.form.tickets_purchased) || 0;
          return price * tickets;
        };

        vm.load = function () {
          if (!vm.eventId || isNaN(Number(vm.eventId))) {
            vm.error = 'No valid event id was supplied.';
            vm.loading = false;
            return;
          }
          apiService.get('/api/events/' + vm.eventId).then(function (result) {
            vm.event = result.data;
            vm.loading = false;
            if (vm.event.event_status === 'Suspended') {
              vm.error = 'This event has been suspended and can no longer be registered for.';
            } else if (vm.event.event_status === 'Past') {
              vm.error = 'This event has already taken place.';
            } else {
              vm.registrationOpen = true;
            }
          }).catch(function (err) {
            vm.error = err.message;
            vm.loading = false;
          });
        };

        vm.submit = function (form) {
          vm.error = '';
          vm.successMessage = '';

          if (form && form.$invalid) {
            vm.error = 'Please complete all the required fields correctly before submitting.';
            return;
          }

          var payload = {
            attendee_name: vm.form.attendee_name,
            attendee_email: vm.form.attendee_email,
            contact_phone: vm.form.contact_phone,
            tickets_purchased: Number(vm.form.tickets_purchased),
            registration_date: vm.form.registration_date
          };

          vm.submitting = true;
          apiService.post('/api/events/' + vm.eventId + '/registrations', payload).then(function (result) {
            vm.submitting = false;
            vm.registrationOpen = false;
            vm.successMessage = 'Registration confirmed! Registration #' + result.data.registration_id
              + ' for ' + result.data.tickets_purchased + ' ticket(s), total '
              + result.data.total_amount.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })
              + '. Redirecting back to the event page…';
            $timeout(function () {
              window.location.href = 'event-detail.html?id=' + vm.eventId;
            }, 2200);
          }).catch(function (err) {
            vm.error = err.message;
            vm.submitting = false;
          });
        };

        vm.load();
      }])

    // =======================================================================
    // Admin-side controllers
    // =======================================================================

    /** Admin dashboard: list every event, show statistics and delete events. */
    .controller('AdminDashboardController', ['apiService', '$window', function (apiService, $window) {
      var vm = this;
      vm.events = [];
      vm.loading = true;
      vm.error = '';
      vm.message = '';

      vm.stats = function () {
        var counts = { total: vm.events.length, active: 0, past: 0, suspended: 0 };
        angular.forEach(vm.events, function (e) {
          if (e.event_status === 'Active') counts.active++;
          else if (e.event_status === 'Past') counts.past++;
          else counts.suspended++;
        });
        return counts;
      };

      vm.load = function () {
        vm.loading = true;
        apiService.get('/api/admin/events').then(function (result) {
          vm.events = result.data;
          vm.loading = false;
        }).catch(function (err) {
          vm.error = err.message;
          vm.loading = false;
        });
      };

      vm.remove = function (event) {
        vm.error = '';
        vm.message = '';
        var confirmed = $window.confirm('Delete the event "' + event.event_title + '"?\n\n'
          + 'This cannot be undone. Events that already have registrations cannot be deleted.');
        if (!confirmed) return;

        apiService.remove('/api/events/' + event.event_id).then(function (result) {
          vm.message = result.message || 'Event deleted successfully.';
          vm.load();
        }).catch(function (err) {
          vm.error = 'Deletion blocked: ' + err.message;
        });
      };

      vm.load();
    }])

    /** Admin "new event" form. */
    .controller('AdminNewEventController', ['apiService', function (apiService) {
      var vm = this;
      vm.organisations = [];
      vm.categories = [];
      vm.error = '';
      vm.saving = false;

      vm.event = {
        organisation_id: null,
        category_id: null,
        event_title: '',
        event_description: '',
        event_date: new Date(),
        location: '',
        latitude: null,
        longitude: null,
        ticket_price: 0,
        fundraising_goal: 0,
        current_progress: 0,
        is_suspended: false
      };

      apiService.get('/api/organisations').then(function (result) {
        vm.organisations = result.data;
        if (vm.organisations.length) vm.event.organisation_id = vm.organisations[0].organisation_id;
      }).catch(function (err) { vm.error = err.message; });

      apiService.get('/api/categories').then(function (result) {
        vm.categories = result.data;
        if (vm.categories.length) vm.event.category_id = vm.categories[0].category_id;
      }).catch(function (err) { vm.error = err.message; });

      vm.save = function (form) {
        vm.error = '';
        if (form && form.$invalid) {
          vm.error = 'Please complete all the required fields before saving.';
          return;
        }
        vm.saving = true;
        apiService.post('/api/events', vm.event).then(function () {
          window.location.href = 'index.html';
        }).catch(function (err) {
          vm.error = 'Could not save the event: ' + err.message;
          vm.saving = false;
        });
      };
    }])

    /** Admin "update event" form (also shows the event registrations). */
    .controller('AdminEditEventController', ['apiService', 'queryParams', '$window',
      function (apiService, queryParams, $window) {
        var vm = this;
        vm.events = [];
        vm.organisations = [];
        vm.categories = [];
        vm.selectedId = queryParams.id || '';
        vm.registrations = [];
        vm.loading = false;
        vm.saving = false;
        vm.error = '';
        vm.message = '';

        apiService.get('/api/organisations').then(function (r) { vm.organisations = r.data; });
        apiService.get('/api/categories').then(function (r) { vm.categories = r.data; });
        apiService.get('/api/admin/events').then(function (r) {
          vm.events = r.data;
          if (vm.selectedId) vm.load(vm.selectedId);
        }).catch(function (err) { vm.error = err.message; });

        vm.load = function (eventId) {
          if (!eventId) return;
          vm.loading = true;
          vm.error = '';
          apiService.get('/api/events/' + eventId).then(function (result) {
            vm.event = result.data;
            vm.event.event_date = new Date(result.data.event_date);
            vm.registrations = result.data.registrations || [];
            vm.loading = false;
          }).catch(function (err) {
            vm.error = err.message;
            vm.loading = false;
          });
        };

        vm.save = function (form) {
          vm.error = '';
          vm.message = '';
          if (form && form.$invalid) {
            vm.error = 'Please complete all the required fields before saving.';
            return;
          }
          vm.saving = true;
          apiService.put('/api/events/' + vm.event.event_id, vm.event).then(function (result) {
            vm.message = result.message || 'Event updated successfully.';
            vm.saving = false;
          }).catch(function (err) {
            vm.error = 'Could not update the event: ' + err.message;
            vm.saving = false;
          });
        };

        vm.remove = function () {
          if (!vm.event) return;
          if (!$window.confirm('Delete this event? Events that already have registrations cannot be deleted.')) return;
          apiService.remove('/api/events/' + vm.event.event_id).then(function () {
            window.location.href = 'index.html';
          }).catch(function (err) {
            vm.error = 'Deletion blocked: ' + err.message;
          });
        };
      }]);

})();
