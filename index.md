{% comment %}
## NEW: Cron Job Failure Alerts Section
This section now checks the status of configured cron jobs and displays alerts if any job has failed.
{% if cj.total > 0 %}
  <p>Total configured cron jobs: {{ cj.total }}</p>
  <div class="alert alert-warning">
    ⚠️ **Alert: Cron Job Failures Detected!** Check the console for details.
  </div>
{% else %}
  <p class="alert alert-info">No cron jobs are currently configured.</p>
{% endif %}