// ============================================================================
// MANTA-JARVIS - Calendar Management
// ============================================================================

window.CalendarManager = (function() {
  let currentDate = new Date();

  function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    if (!grid) return;
    
    grid.innerHTML = '';

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const monthElement = document.getElementById('currentMonth');
    if (monthElement) {
      monthElement.textContent = new Date(year, month).toLocaleDateString('en-US', { 
        month: 'long', 
        year: 'numeric' 
      });
    }

    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayHeaders.forEach(day => {
      const header = document.createElement('div');
      header.className = 'calendar-day-header';
      header.textContent = day;
      grid.appendChild(header);
    });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    for (let i = 0; i < firstDay; i++) {
      grid.appendChild(document.createElement('div'));
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dayEl = document.createElement('div');
      dayEl.className = 'calendar-day';
      
      const isToday = day === today.getDate() && 
                     month === today.getMonth() && 
                     year === today.getFullYear();
      
      if (isToday) {
        dayEl.classList.add('today');
      }
      
      dayEl.textContent = day;
      grid.appendChild(dayEl);
    }
  }

  async function loadEvents() {
    const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!currentUser) {
      console.log('No user logged in, skipping event load');
      return;
    }
    
    const events = await window.getUserEvents(currentUser);
    console.log('Loading events for user:', currentUser, 'Events:', events);
    
    const eventList = document.getElementById('eventList');
    if (!eventList) return;
    
    eventList.innerHTML = '';

    if (!events || events.length === 0) {
      eventList.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">No events yet. Create one by saying "create event workout tomorrow at 6am"</div>';
      return;
    }

    const now = new Date();
    const upcomingEvents = events
      .filter(e => new Date(e.start) >= now)
      .sort((a, b) => new Date(a.start) - new Date(b.start));

    if (upcomingEvents.length === 0) {
      eventList.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">No upcoming events. All your events are in the past.</div>';
      return;
    }

    upcomingEvents.forEach(event => {
      const eventEl = document.createElement('div');
      eventEl.className = 'event-item';
      
      const startDate = new Date(event.start);
      const endDate = new Date(event.end);
      
      eventEl.innerHTML = `
        <div class="event-title">${event.summary}</div>
        <div class="event-time">
          📅 ${startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}<br>
          ⏰ ${startDate.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} - 
          ${endDate.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
        </div>
        <div class="event-actions">
          <button class="btn-edit" onclick="window.CalendarManager.editEvent('${event.id}')">Edit</button>
          <button class="btn-delete" onclick="window.CalendarManager.deleteEventById('${event.id}')">Delete</button>
        </div>
      `;
      
      eventList.appendChild(eventEl);
    });
    
    console.log('✅ Loaded', upcomingEvents.length, 'upcoming events');
  }

  async function editEvent(eventId) {
    const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!currentUser) return;
    
    const events = await window.getUserEvents(currentUser);
    const event = events.find(e => e.id === eventId);
    if (!event) return;
    
    const newTitle = prompt('Edit event title:', event.summary);
    if (newTitle && newTitle !== event.summary) {
      await window.updateEvent(currentUser, eventId, { summary: newTitle });
      // updateEvent already calls renderCalendar and loadEvents
    }
  }

  async function deleteEventById(eventId) {
    const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!currentUser) return;
    
    if (confirm('Are you sure you want to delete this event?')) {
      await window.deleteEvent(currentUser, eventId);
      // deleteEvent already calls renderCalendar and loadEvents
    }
  }

  function init() {
    console.log('Calendar Manager initialized');
    renderCalendar();
    
    const prevBtn = document.getElementById('prevMonth');
    const nextBtn = document.getElementById('nextMonth');
    
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
      });
    }
    
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
      });
    }
  }

  // Public API
  return {
    init,
    renderCalendar,
    loadEvents,
    editEvent,
    deleteEventById
  };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.CalendarManager.init();
  });
} else {
  window.CalendarManager.init();
}