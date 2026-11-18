// Generated from actual Composio session/tool schemas on 2026-10-27.
// Read/write classification is reviewed here; discovery never grants execution.
export const reviewedTools = [
  {
    "name": "GMAIL_FETCH_EMAILS",
    "toolkit": "gmail",
    "description": "Fetches a list of email messages from a Gmail account, supporting filtering, pagination, and optional full content retrieval. Results are NOT sorted by recency; sort by internalDate client-side. The messages field may be absent or empty (valid no-results state); always null-check before accessing messageId or threadId. Null-check subject and header fields before string operations. For large result sets, prefer ids_only=true or metadata-only listing, then hydrate via GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID.",
    "requiresConfirmation": false,
    "parameters": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "examples": [
            "from:john@example.com is:unread",
            "subject:meeting has:attachment",
            "after:2024/01/01 before:2024/02/01",
            "is:snoozed",
            "is:important OR is:starred",
            "label:work -label:spam"
          ],
          "description": "Gmail advanced search query (e.g., 'from:user subject:meeting'). Supported operators: 'from:', 'to:', 'subject:', 'label:', 'has:', 'is:', 'in:', 'category:', 'after:YYYY/MM/DD', 'before:YYYY/MM/DD', AND/OR/NOT. IMPORTANT - 'is:' vs 'label:' usage: Use 'is:' for special mail states: is:snoozed, is:unread, is:read, is:starred, is:important. Use 'label:' ONLY for user-created labels (e.g., 'label:work', 'label:projects'). Note: 'muted' may work with both 'is:muted' and 'label:muted' based on community reports. Common mistake: 'label:snoozed' is WRONG - use 'is:snoozed' instead. Use quotes for exact phrases. Omit for no query filter. after:/before: evaluate whole calendar days in UTC; before: is exclusive — adjust for local timezone to avoid off-by-one-day gaps."
        },
        "user_id": {
          "type": "string",
          "default": "me",
          "examples": [
            "me",
            "user@example.com"
          ],
          "description": "User's email address or 'me' for the authenticated user. Non-'me' addresses require domain-level delegation; without it, authentication or not-found errors result."
        },
        "verbose": {
          "type": "boolean",
          "default": true,
          "examples": [
            true,
            false
          ],
          "description": "If false, uses optimized concurrent metadata fetching for faster performance (~75% improvement). If true, uses standard detailed message fetching. When false, only essential fields (subject, sender, recipient, time, labels) are guaranteed. Body content and attachment details require verbose=true even when include_payload=true."
        },
        "ids_only": {
          "type": "boolean",
          "default": false,
          "examples": [
            true,
            false
          ],
          "description": "If true, only returns message IDs from the list API without fetching individual message details. Fastest option for getting just message IDs and thread IDs."
        },
        "label_ids": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "examples": [
            "INBOX",
            "UNREAD",
            "Label_123456"
          ],
          "description": "Filter by label IDs; only messages with all specified labels are returned (AND logic). Optional - omit or use empty list to fetch all messages without label filtering. System label IDs: 'INBOX', 'SPAM', 'TRASH', 'UNREAD', 'STARRED', 'IMPORTANT', 'CATEGORY_PRIMARY' (alias 'CATEGORY_PERSONAL'), 'CATEGORY_SOCIAL', 'CATEGORY_PROMOTIONS', 'CATEGORY_UPDATES', 'CATEGORY_FORUMS'. For custom/user-created labels, you MUST use the label ID (e.g., 'Label_123456'), NOT the display name. Use the 'listLabels' action to find label IDs for custom labels. Combining label_ids with label: in query applies AND logic across both, which can silently over-restrict results; use one strategy consistently."
        },
        "page_token": {
          "type": "string",
          "description": "Token for retrieving a specific page, obtained from a previous response's `nextPageToken`. Must be a valid opaque token string from a previous API response. Do not pass arbitrary values. Omit for the first page. Loop calls using nextPageToken until it is absent to avoid silently missing messages. resultSizeEstimate is approximate — do not use as a stopping condition."
        },
        "max_results": {
          "type": "integer",
          "default": 1,
          "maximum": 500,
          "minimum": 1,
          "examples": [
            "10",
            "100",
            "500"
          ],
          "description": "Maximum number of messages to retrieve per page. Default of 1 retrieves only a single message; set higher for practical use. Hard cap is 500 per page."
        },
        "include_payload": {
          "type": "boolean",
          "default": true,
          "examples": [
            true,
            false
          ],
          "description": "Set to true to include full message payload (headers, body, attachments); false for metadata only. payload may still be null even when true; use GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID for guaranteed complete content. When payload is present, bodies are base64url-encoded in payload.parts; replace '-'→'+' and '_'→'/' and fix padding before decoding, and check both text/plain and text/html parts."
        },
        "include_spam_trash": {
          "type": "boolean",
          "default": false,
          "examples": [
            true,
            false
          ],
          "description": "Set to true to include messages from 'SPAM' and 'TRASH'."
        }
      }
    }
  },
  {
    "name": "GOOGLECALENDAR_FIND_EVENT",
    "toolkit": "googlecalendar",
    "description": "Finds events in a specified Google Calendar using text query, time ranges (event start/end, last modification), and event types. Ensure `timeMin` is not chronologically after `timeMax` if both are provided. Results may span multiple pages; always follow `nextPageToken` until absent to avoid silently missing events. Validate the correct match from results by checking summary, start.dateTime, and organizer.email before using event_id for mutations. An empty `items` array means no events matched — widen filters rather than treating it as an error.",
    "requiresConfirmation": false,
    "parameters": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "examples": [
            "Project Alpha Review",
            "Birthday Party",
            "Q3 Planning session"
          ],
          "description": "Free-text search terms to find events. This query is matched against various event fields including summary, description, location, attendees' details (displayName, email), and organizer's details. Cannot search by event_id. Performs full-text match (not exact); broad terms may return unrelated events. For person-based matching, prefer attendees[].email over display names. If results appear incomplete, use GOOGLECALENDAR_EVENTS_LIST with client-side filtering."
        },
        "order_by": {
          "type": "string",
          "examples": [
            "startTime",
            "updated"
          ],
          "description": "Order of events: 'startTime' (ascending by start time) or 'updated' (ascending by last modification time). Note: 'startTime' requires single_events=true. Use 'updated' if you need to include recurring masters (e.g., cancelled series)."
        },
        "time_max": {
          "type": "string",
          "examples": [
            "2024-12-31T23:59:59Z",
            "2025-01-01 10:00:00"
          ],
          "description": "Upper bound (exclusive) for an event's start time to filter by. Only events starting before this time are included. Accepts multiple formats:\n1. RFC3339 timestamp (e.g., '2024-12-06T13:00:00Z')\n2. Comma-separated date/time parts (e.g., '2024,12,06,13,00,00')\n3. Simple datetime string (e.g., '2024-12-06 13:00:00') Set to the first instant after the desired period to avoid missing boundary events, especially all-day events (date-only fields). Overly wide ranges expand many recurring instances, causing large payloads and high latency — constrain to the minimum required window."
        },
        "time_min": {
          "type": "string",
          "examples": [
            "2024-01-01T00:00:00Z",
            "2024-06-15 09:00:00"
          ],
          "description": "Lower bound (exclusive) for an event's end time to filter by. Only events ending after this time are included. Accepts multiple formats:\n1. RFC3339 timestamp (e.g., '2024-12-06T13:00:00Z')\n2. Comma-separated date/time parts (e.g., '2024,12,06,13,00,00')\n3. Simple datetime string (e.g., '2024-12-06 13:00:00') RFC3339 timestamps must include explicit timezone offsets; missing or mismatched offsets can silently exclude matching events. To align with the calendar's timezone, retrieve it via GOOGLECALENDAR_GET_CALENDAR."
        },
        "page_token": {
          "type": "string",
          "description": "Token from a previous response's `nextPageToken` to fetch the subsequent page of results. Always follow every `nextPageToken` until absent; skipping pagination silently omits events on busy calendars."
        },
        "calendar_id": {
          "type": "string",
          "default": "primary",
          "examples": [
            "primary",
            "user@example.com",
            "abc123xyz@group.calendar.google.com"
          ],
          "description": "Identifier of the Google Calendar to query. IMPORTANT: This must be a valid calendar identifier, NOT a calendar name/title. Valid formats are: 'primary' (the authenticated user's primary calendar), an email address (e.g., 'user@example.com'), or a calendar ID (e.g., 'abc123xyz@group.calendar.google.com'). To find the calendar ID for a named calendar, first use the List Calendars action (GOOGLECALENDAR_LIST_CALENDARS) to retrieve all available calendars with their IDs. 'primary' searches only the authenticated user's primary calendar; to search all calendars, retrieve each ID via GOOGLECALENDAR_LIST_CALENDARS and query separately."
        },
        "event_types": {
          "type": "array",
          "items": {
            "enum": [
              "birthday",
              "default",
              "focusTime",
              "outOfOffice",
              "workingLocation"
            ],
            "type": "string",
            "description": "Event type constraints:\n- 'birthday': Requires transparency='transparent', description must be omitted\n- 'outOfOffice': Requires calendar_id='primary', Workspace/enterprise calendar,\n  transparency='opaque', location and attendees must be omitted,\n  create_meeting_room must be false\n- 'focusTime': Requires Google Workspace Enterprise account with Focus Time feature enabled\n- 'workingLocation': Requires Google Workspace Enterprise account"
          },
          "default": [
            "birthday",
            "default",
            "focusTime",
            "outOfOffice",
            "workingLocation"
          ],
          "examples": [
            "default",
            "focusTime",
            "outOfOffice",
            "birthday",
            "workingLocation"
          ],
          "description": "Event types to include. Supported values: 'birthday', 'default', 'focusTime', 'outOfOffice', 'workingLocation'."
        },
        "max_results": {
          "type": "integer",
          "default": 10,
          "description": "Maximum number of events per page (1-2500)."
        },
        "updated_min": {
          "type": "string",
          "examples": [
            "2024-07-01T00:00:00Z"
          ],
          "description": "Lower bound (exclusive) for an event's last modification time to filter by. Only events updated after this time are included. When specified, events deleted since this time are also included, regardless of the `show_deleted` parameter. Accepts multiple formats:\n1. RFC3339 timestamp (e.g., '2024-12-06T13:00:00Z')\n2. Comma-separated date/time parts (e.g., '2024,12,06,13,00,00')\n3. Simple datetime string (e.g., '2024-12-06 13:00:00')"
        },
        "show_deleted": {
          "type": "boolean",
          "description": "Include events whose status is 'cancelled'. This surfaces cancelled/deleted events, not a separate 'trash' view. Behavior with recurring events: when single_events=true, only individual cancelled instances are returned (the recurring master is omitted); to include cancelled recurring masters, set single_events=false. If updated_min is provided, events deleted since that time are included regardless of this flag."
        },
        "single_events": {
          "type": "boolean",
          "default": true,
          "description": "When true, recurring event series are expanded into their individual instances. When false, only the recurring master events are returned. Note: Ordering by 'startTime' requires singleEvents=true. For large calendars, it is strongly recommended to specify both timeMin and timeMax to limit the expansion window and improve performance."
        }
      }
    }
  },
  {
    "name": "GOOGLECALENDAR_FIND_FREE_SLOTS",
    "toolkit": "googlecalendar",
    "description": "Finds both free and busy time slots in Google Calendars for specified calendars within a defined time range. If `time_min` is not provided, defaults to the current timestamp in the specified timezone. If `time_max` is not provided, defaults to 23:59:59 of the day specified in `time_min` (if provided), otherwise defaults to 23:59:59 of the current day in the specified timezone. Returns busy intervals and calculates free slots by finding gaps between busy periods; `time_min` must precede `time_max` if both are provided. This action retrieves free and busy time slots for the specified calendars over a given time period. It analyzes the busy intervals from the calendars and provides calculated free slots based on the gaps in the busy periods. Returned free slots are unfiltered by duration; callers must filter intervals to those fully containing the required meeting length. No event metadata (titles, descriptions, links) is returned; use GOOGLECALENDAR_EVENTS_LIST for event details.",
    "requiresConfirmation": false,
    "parameters": {
      "type": "object",
      "properties": {
        "items": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "default": [
            "primary"
          ],
          "examples": [
            [
              "primary"
            ],
            [
              "primary",
              "user@example.com"
            ]
          ],
          "description": "List of calendar identifiers to query for free/busy information. Pass as a simple list of strings, e.g., ['primary'] or ['primary', 'user@example.com']. Valid values include: 'primary' (authenticated user's main calendar), calendar IDs from the user's calendar list (typically ending in @group.calendar.google.com), or email addresses of users whose free/busy information you want to query. The FreeBusy API will return error information for any calendars that are not accessible or invalid in the response under the 'errors' key for each calendar. Calendars omitted from `items` or inaccessible are treated as free (not unknown), which can silently produce incorrect availability results."
        },
        "time_max": {
          "type": "string",
          "examples": [
            "2024-12-06T18:00:00Z",
            "2024,12,06,18,00,00",
            "2024-12-06 18:00:00"
          ],
          "description": "End datetime for the query interval. Accepts ISO, comma-separated, or simple datetime formats. If provided without an explicit timezone, it is interpreted in the specified `timezone`. If not provided, defaults to 23:59:59 of the day specified in `time_min` (if provided), otherwise defaults to 23:59:59 of the current day in the specified `timezone`. Maximum span between time_min and time_max is approximately 90 days per Google Calendar freeBusy API limit. `time_max` is exclusive; to cover a full day, set `time_max` to 00:00:00 of the following day in the target timezone rather than 23:59:59."
        },
        "time_min": {
          "type": "string",
          "examples": [
            "2024-12-06T13:00:00Z",
            "2024,12,06,13,00,00",
            "2024-12-06 13:00:00"
          ],
          "description": "Start datetime for the query interval. Accepts ISO, comma-separated, or simple datetime formats. If provided without an explicit timezone, it is interpreted in the specified `timezone`. If not provided, defaults to the current timestamp in the specified `timezone` to ensure only future/bookable slots are returned. Maximum span between time_min and time_max is approximately 90 days per Google Calendar freeBusy API limit."
        },
        "timezone": {
          "type": "string",
          "default": "UTC",
          "examples": [
            "UTC",
            "America/New_York",
            "Europe/Berlin"
          ],
          "description": "IANA timezone identifier (e.g., 'America/New_York', 'Europe/London', 'Asia/Tokyo'). Determines how naive `time_min`/`time_max` are interpreted and the timezone used in the response for `timeMin`, `timeMax`, busy periods, and calculated free slots. Note: 'local' is not supported; use a specific IANA timezone name."
        },
        "group_expansion_max": {
          "type": "integer",
          "default": 100,
          "maximum": 100,
          "minimum": 1,
          "description": "Maximum calendar identifiers to return for a single group. Must be between 1 and 100 (inclusive). Values exceeding 100 will be rejected."
        },
        "calendar_expansion_max": {
          "type": "integer",
          "default": 50,
          "maximum": 50,
          "minimum": 1,
          "description": "Maximum calendars for which FreeBusy information is provided. Must be between 1 and 50 (inclusive). Values exceeding 50 will be rejected."
        }
      }
    }
  },
  {
    "name": "GOOGLECALENDAR_CREATE_EVENT",
    "toolkit": "googlecalendar",
    "description": "Creates a timed event using start_datetime and either end_datetime or duration fields, or an all-day event using an inclusive start_date and exclusive end_date. send_updates defaults to \"all\", which emails all attendees; choose \"externalOnly\" or \"none\" to control notifications. The organizer is added as an attendee unless exclude_organizer is true, and a Google Meet link is requested by default. No conflict checking is performed; use GOOGLECALENDAR_FREE_BUSY_QUERY first when conflicts matter. Returns the created event under response_data.",
    "requiresConfirmation": true,
    "parameters": {
      "type": "object",
      "properties": {
        "summary": {
          "type": "string",
          "description": "Summary (title) of the event."
        },
        "end_date": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}$",
          "description": "Exclusive end date for an all-day event in YYYY-MM-DD format. Must be provided together with start_date and be later than start_date."
        },
        "location": {
          "type": "string",
          "description": "Geographic location of the event as free-form text."
        },
        "timezone": {
          "type": "string",
          "description": "IANA timezone name from the timezone database (e.g., 'America/New_York', 'Europe/London', 'Asia/Jerusalem', 'UTC'). Required if datetime is naive. For recurring events, start and end must include a timeZone. If not provided, UTC is used. If datetime includes timezone info (Z or offset), this field is optional and defaults to UTC. IMPORTANT: Must be a valid IANA timezone identifier. Values like 'EST', 'PST', 'ISRAEL TIME', or other abbreviations are NOT valid IANA timezone names."
        },
        "attendees": {
          "type": "array",
          "items": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "object",
                "additionalProperties": true
              }
            ]
          },
          "description": "List of attendees. Each attendee can be either: (1) A string email address (e.g., 'user@example.com'), or (2) An object with 'email' (required), 'optional' (boolean, default false), 'displayName' (string), 'comment' (string), 'additionalGuests' (integer), and 'resource' (boolean). To mark an attendee as optional (not required), use object format: {'email': 'user@example.com', 'optional': true}. IMPORTANT: Only valid email addresses are accepted. Plain names cannot be used."
        },
        "eventType": {
          "enum": [
            "birthday",
            "default",
            "focusTime",
            "outOfOffice",
            "workingLocation"
          ],
          "type": "string",
          "default": "default",
          "description": "Type of the event, immutable post-creation. 'workingLocation' (REQUIRES Google Workspace Enterprise). Note: 'fromGmail' events cannot be created via API."
        },
        "recurrence": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "List of RRULE, EXRULE, RDATE, EXDATE lines for recurring events. Supported frequencies: DAILY, WEEKLY, MONTHLY, YEARLY. For recurring events, start.timeZone and end.timeZone must be present. UNTIL values follow RFC 5545: date-only (YYYYMMDD) for all-day events, or UTC datetime with Z suffix (YYYYMMDDTHHMMSSZ) for timed events. UNTIL values with time but missing Z suffix are auto-corrected. Provide an empty list to remove recurrence so the event becomes non-recurring."
        },
        "start_date": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}$",
          "description": "Inclusive start date for an all-day event in YYYY-MM-DD format. Must be provided together with end_date and without start_datetime or end_datetime."
        },
        "visibility": {
          "enum": [
            "default",
            "public",
            "private",
            "confidential"
          ],
          "type": "string",
          "default": "default",
          "description": "Event visibility: 'default', 'public', 'private', or 'confidential'."
        },
        "calendar_id": {
          "type": "string",
          "default": "primary",
          "examples": [
            "primary",
            "abcdefghijklmnopqrstuvwxyz@group.calendar.google.com"
          ],
          "description": "Calendar identifier. Use 'primary' (recommended) for the user's main calendar. Alternatively, use a calendar ID from the user's accessible calendar list. Calendar IDs look like email addresses (e.g., 'xyz@group.calendar.google.com' for shared calendars). Important: Arbitrary email addresses will NOT work - the calendar must exist in the user's calendar list with appropriate access permissions. Use GOOGLECALENDAR_LIST_CALENDARS to retrieve valid calendar IDs."
        },
        "description": {
          "type": "string",
          "description": "Description of the event. Can contain HTML. Optional. Must be omitted for 'birthday' event type."
        },
        "end_datetime": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}[T ]\\d{2}:\\d{2}(:\\d{2})?(\\.\\d+)?(Z|[+-]\\d{1,2}(:?\\d{2})?)?$",
          "description": "Event end time in ISO 8601 format: YYYY-MM-DDTHH:MM:SS. When provided, this parameter takes precedence over event_duration_hour and event_duration_minutes. If not provided, the end time is calculated using start_datetime + duration. Must be after start_datetime. Explicit timezone information (Z or an offset) is preserved; offset-less values are interpreted in `timezone`, or UTC when it is omitted."
        },
        "send_updates": {
          "enum": [
            "all",
            "externalOnly",
            "none"
          ],
          "type": "string",
          "description": "Options for who should receive notifications about event changes."
        },
        "transparency": {
          "enum": [
            "opaque",
            "transparent"
          ],
          "type": "string",
          "default": "opaque",
          "description": "'opaque' (busy) or 'transparent' (available)."
        },
        "start_datetime": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}[T ]\\d{2}:\\d{2}(:\\d{2})?(\\.\\d+)?(Z|[+-]\\d{1,2}(:?\\d{2})?)?$",
          "description": "Event start time in ISO 8601 format: YYYY-MM-DDTHH:MM:SS. Required for timed events; omit it when using start_date and end_date for an all-day event."
        },
        "guestsCanModify": {
          "type": "boolean",
          "description": "If True, guests can modify the event."
        },
        "exclude_organizer": {
          "type": "boolean",
          "default": false,
          "description": "If True, the organizer will NOT be added as an attendee. Default is False (organizer is included)."
        },
        "birthdayProperties": {
          "type": "object",
          "properties": {
            "type": {
              "enum": [
                "birthday",
                "anniversary",
                "other"
              ],
              "type": "string",
              "default": "birthday",
              "description": "Type of birthday event: 'birthday', 'anniversary', or 'other'. Defaults to 'birthday'."
            },
            "contact": {
              "type": "string",
              "description": "Contact ID in format 'people/c12345' from Google People API. REQUIRED when type is 'anniversary' or 'other'. MUST BE OMITTED when type is 'birthday' (the API forbids contact field for type='birthday')."
            },
            "customTypeName": {
              "type": "string",
              "description": "Custom type name when type is 'other'. Requires valid contact field."
            }
          },
          "description": "Properties for birthday events.",
          "additionalProperties": false
        },
        "create_meeting_room": {
          "type": "boolean",
          "default": true,
          "description": "Defaults to True. When True, for CREATE operations creates a Google Meet link; for UPDATE operations preserves existing conference data if present, or adds a new Meet link if none exists. Google Workspace accounts will successfully receive a Meet link. Personal Gmail accounts and other unsupported accounts will gracefully fallback to creating an event without a Meet link when conference creation fails. Set to False to skip Meet link operations (won't create new or modify existing conference data). The fallback ensures event creation succeeds even when conference features are unavailable due to account limitations."
        },
        "event_duration_hour": {
          "type": "integer",
          "default": 0,
          "minimum": 0,
          "description": "Number of hours for the event duration. Supports multi-day events (e.g., 240 hours = 10 days). For durations under 1 hour, use event_duration_minutes instead. Ignored if end_datetime is provided."
        },
        "extended_properties": {
          "type": "object",
          "description": "Extended properties of the event for storing custom metadata. Contains 'private' (visible only on this calendar) and/or 'shared' (visible to all attendees) dictionaries mapping string keys to string values. Example: {'private': {'key1': 'value1'}, 'shared': {'key2': 'value2'}}",
          "additionalProperties": {
            "type": "object",
            "additionalProperties": {
              "type": "string"
            }
          }
        },
        "focusTimeProperties": {
          "type": "object",
          "properties": {
            "chatStatus": {
              "enum": [
                "active",
                "doNotDisturb"
              ],
              "type": "string",
              "description": "Chat status during focus time: 'active' or 'doNotDisturb'."
            },
            "declineMessage": {
              "type": "string",
              "description": "Message to include in declined meeting invitations. Only used when autoDeclineMode is set."
            },
            "autoDeclineMode": {
              "enum": [
                "declineNone",
                "declineAllConflictingInvitations",
                "declineOnlyNewConflictingInvitations"
              ],
              "type": "string",
              "description": "Auto decline mode: 'declineNone' (no invitations declined), 'declineAllConflictingInvitations' (all conflicting invitations declined), or 'declineOnlyNewConflictingInvitations' (only new conflicting invitations declined)."
            }
          },
          "description": "Properties for focusTime events. REQUIRES Google Workspace Enterprise account with Focus Time feature enabled.",
          "additionalProperties": false
        },
        "guestsCanInviteOthers": {
          "type": "boolean",
          "description": "Whether attendees other than the organizer can invite others to the event."
        },
        "outOfOfficeProperties": {
          "type": "object",
          "properties": {
            "declineMessage": {
              "type": "string",
              "description": "Message to include in declined meeting invitations. Only used when autoDeclineMode is set."
            },
            "autoDeclineMode": {
              "enum": [
                "declineNone",
                "declineAllConflictingInvitations",
                "declineOnlyNewConflictingInvitations"
              ],
              "type": "string",
              "description": "Auto decline mode: 'declineNone' (no invitations declined), 'declineAllConflictingInvitations' (all conflicting invitations declined), or 'declineOnlyNewConflictingInvitations' (only new conflicting invitations declined). RECURRING EVENT RESTRICTION: For recurring out-of-office events, ONLY 'declineOnlyNewConflictingInvitations' is allowed. Cannot use 'declineAllConflictingInvitations' for recurring OOO (Google Calendar prevents retroactively declining existing meetings). REQUIRES Google Workspace (paid business subscription, e.g., Business Starter at $6/user/month). Personal Gmail accounts cannot use this feature."
            }
          },
          "description": "Properties for outOfOffice events.",
          "additionalProperties": false
        },
        "event_duration_minutes": {
          "type": "integer",
          "default": 30,
          "maximum": 59,
          "minimum": 0,
          "description": "Duration in minutes (0-59 ONLY). NEVER use 60+ minutes - use event_duration_hour=1 instead. Maximum value is 59. Combined duration (hours + minutes) must be greater than 0. Ignored if end_datetime is provided."
        },
        "guestsCanSeeOtherGuests": {
          "type": "boolean",
          "description": "Whether attendees other than the organizer can see who the event's attendees are."
        },
        "workingLocationProperties": {
          "type": "object",
          "required": [
            "type"
          ],
          "properties": {
            "type": {
              "enum": [
                "homeOffice",
                "officeLocation",
                "customLocation"
              ],
              "type": "string",
              "description": "Type of working location ('homeOffice' | 'officeLocation' | 'customLocation')."
            },
            "homeOffice": {
              "type": "object",
              "properties": {},
              "description": "Empty object marker for home office working location.\n\nThis is used to indicate the user is working from home.\nGoogle Calendar API accepts an empty object for this field.",
              "additionalProperties": false
            },
            "customLocation": {
              "type": "object",
              "required": [
                "label"
              ],
              "properties": {
                "label": {
                  "type": "string",
                  "description": "Label for a custom working location (e.g., 'Client site')."
                }
              },
              "description": "Custom working location with a display label.",
              "additionalProperties": false
            },
            "officeLocation": {
              "type": "object",
              "properties": {
                "label": {
                  "type": "string",
                  "description": "Office name displayed in Calendar clients (e.g., building name)."
                },
                "deskId": {
                  "type": "string",
                  "description": "Optional desk identifier."
                },
                "floorId": {
                  "type": "string",
                  "description": "Optional floor identifier."
                },
                "buildingId": {
                  "type": "string",
                  "description": "Optional building identifier from org Resources."
                },
                "floorSectionId": {
                  "type": "string",
                  "description": "Optional floor section identifier."
                }
              },
              "description": "Office-based working location details.",
              "additionalProperties": false
            }
          },
          "description": "Properties for workingLocation events. REQUIRES Google Workspace Enterprise.\n\nConstraints discovered from testing:\n- Must set transparency='transparent' and visibility='public'\n- Description must be omitted\n- Depending on 'type', include one of 'homeOffice', 'officeLocation', or 'customLocation'",
          "additionalProperties": false
        }
      }
    }
  },
  {
    "name": "GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER",
    "toolkit": "github",
    "description": "Lists repositories for the authenticated user; using 'type' with 'visibility' or 'affiliation' API parameters (not in this model) can cause a 422 error.",
    "requiresConfirmation": false,
    "parameters": {
      "type": "object",
      "properties": {
        "page": {
          "type": "integer",
          "default": 1,
          "examples": [
            "1",
            "2",
            "10"
          ],
          "description": "Page number of results to fetch."
        },
        "sort": {
          "enum": [
            "created",
            "updated",
            "pushed",
            "full_name"
          ],
          "type": "string",
          "default": "full_name",
          "examples": [
            "created",
            "full_name",
            "updated"
          ],
          "description": "The repository property by which to sort the results."
        },
        "type": {
          "enum": [
            "all",
            "owner",
            "public",
            "private",
            "member"
          ],
          "type": "string",
          "default": "all",
          "examples": [
            "all",
            "owner",
            "member"
          ],
          "description": "Filters the results to repositories of the specified type."
        },
        "since": {
          "type": "string",
          "examples": [
            "2023-01-01T00:00:00Z",
            "2023-05-15T10:30:00-07:00"
          ],
          "description": "Filters for repositories updated at or after this specified time. Provide as an ISO 8601 formatted timestamp."
        },
        "before": {
          "type": "string",
          "examples": [
            "2024-01-01T00:00:00Z",
            "2024-03-20T18:45:00+00:00"
          ],
          "description": "Filters for repositories updated before this specified time. Provide as an ISO 8601 formatted timestamp."
        },
        "per_page": {
          "type": "integer",
          "default": 30,
          "examples": [
            "30",
            "50",
            "100"
          ],
          "description": "The number of results to return per page (maximum 100)."
        },
        "direction": {
          "enum": [
            "asc",
            "desc"
          ],
          "type": "string",
          "examples": [
            "asc",
            "desc"
          ],
          "description": "The direction of the sort. Defaults to `asc` when `sort` is 'full_name', and `desc` otherwise."
        }
      }
    }
  },
  {
    "name": "GITHUB_LIST_REPOSITORY_ISSUES",
    "toolkit": "github",
    "description": "Lists issues (including pull requests) from a GitHub repository. Requires BOTH 'owner' AND 'repo' parameters (e.g., owner='octocat', repo='Hello-World' for github.com/octocat/Hello-World).",
    "requiresConfirmation": false,
    "parameters": {
      "type": "object",
      "required": [
        "owner",
        "repo"
      ],
      "properties": {
        "page": {
          "type": "integer",
          "default": 1,
          "examples": [
            "1",
            "5"
          ],
          "description": "Page number for the set of results. Refer to GitHub's REST API documentation for pagination details."
        },
        "repo": {
          "type": "string",
          "examples": [
            "Hello-World",
            "vscode",
            "react"
          ],
          "description": "REQUIRED. The name of the repository (without .git extension). For 'octocat/Hello-World', repo is 'Hello-World'. Not case-sensitive. Must be provided together with 'owner'."
        },
        "sort": {
          "enum": [
            "created",
            "updated",
            "comments"
          ],
          "type": "string",
          "default": "created",
          "examples": [
            "created",
            "updated",
            "comments"
          ],
          "description": "The field to sort the results by."
        },
        "type": {
          "type": "string",
          "examples": [
            "bug",
            "feature",
            "*",
            "none"
          ],
          "description": "Filter issues by type name. Use '*' for issues with any type, 'none' for issues without a type, or specify a type name."
        },
        "owner": {
          "type": "string",
          "examples": [
            "octocat",
            "microsoft",
            "facebook"
          ],
          "description": "REQUIRED. The GitHub account owner (user or organization) of the repository. For 'octocat/Hello-World', owner is 'octocat'. Not case-sensitive. Must be provided together with 'repo'."
        },
        "since": {
          "type": "string",
          "examples": [
            "2023-01-15T10:00:00Z",
            "2024-03-10T00:00:00+05:30"
          ],
          "description": "Filters issues to include only those updated at or after the specified time. This should be a timestamp in ISO 8601 format (e.g., `YYYY-MM-DDTHH:MM:SSZ`)."
        },
        "state": {
          "enum": [
            "open",
            "closed",
            "all"
          ],
          "type": "string",
          "default": "open",
          "examples": [
            "open",
            "closed",
            "all"
          ],
          "description": "Filters issues based on their state."
        },
        "labels": {
          "type": "string",
          "examples": [
            "bug,ui,@high",
            "enhancement",
            "help wanted,good first issue"
          ],
          "description": "A comma-separated list of label names to filter issues by. Example: 'bug,ui,@high'."
        },
        "creator": {
          "type": "string",
          "examples": [
            "octocat"
          ],
          "description": "Filter issues by the username of the user who created the issue."
        },
        "assignee": {
          "type": "string",
          "examples": [
            "codertocat",
            "none",
            "*"
          ],
          "description": "Filter issues by assignee's username. Use 'none' for issues with no assignee, or '*' for issues assigned to any user."
        },
        "per_page": {
          "type": "integer",
          "default": 30,
          "examples": [
            "30",
            "100"
          ],
          "description": "Number of results per page (max 100). Default is 30, which matches GitHub's API default. Refer to GitHub's REST API documentation for pagination details."
        },
        "direction": {
          "enum": [
            "asc",
            "desc"
          ],
          "type": "string",
          "default": "desc",
          "examples": [
            "asc",
            "desc"
          ],
          "description": "The direction of the sort."
        },
        "mentioned": {
          "type": "string",
          "examples": [
            "octodocs",
            "hubot"
          ],
          "description": "Filter issues by a user mentioned in the issue's description or comments. Provide the username."
        },
        "milestone": {
          "type": "string",
          "examples": [
            "1",
            "*",
            "none"
          ],
          "description": "Filter issues by milestone. Provide the milestone `number` as a string, '*' for issues with any milestone, or 'none' for issues without a milestone."
        }
      }
    }
  },
  {
    "name": "SLACK_LIST_ALL_CHANNELS",
    "toolkit": "slack",
    "description": "Lists conversations available to the user with various filters and search options. Always use resolved `channel_id` (not display names) for downstream operations, as names may be non-unique. The `created` field in results is a Unix epoch timestamp (UTC). Pagination across large workspaces may return HTTP 429 with a `Retry-After` header; honor the delay and resume from the last successful cursor.",
    "requiresConfirmation": false,
    "parameters": {
      "type": "object",
      "properties": {
        "limit": {
          "type": "integer",
          "default": 1,
          "examples": [
            100,
            500,
            1000
          ],
          "description": "Maximum number of channels to return per page (1 to 1000). Fewer channels may be returned than requested. This schema defaults to 1 if omitted."
        },
        "types": {
          "type": "string",
          "examples": [
            "public_channel,private_channel",
            "im,mpim"
          ],
          "description": "Comma-separated list of conversation types to include: `public_channel` (regular #channels everyone can join), `private_channel` (invite-only channels), `im` (1-on-1 direct messages), `mpim` (group direct messages with 3+ people). Defaults to `public_channel` if omitted. Private channels, IMs, and MPIMs only appear if the authenticated user/bot is a member and the token has the required scopes; absence from results reflects access limits, not non-existence."
        },
        "cursor": {
          "type": "string",
          "examples": [
            "dXNlcjpVMDYxTkZUVDI=",
            "bmV4dF90czoxNTEyMDg1ODYxMDAwNTQ5"
          ],
          "description": "Pagination cursor (from a previous response's `next_cursor`) for the next page of results. Omit for the first page. Loop on `response_metadata.next_cursor` until it is empty to retrieve all channels; stopping early silently omits results."
        },
        "team_id": {
          "type": "string",
          "examples": [
            "T1234567890"
          ],
          "description": "ID of the Slack workspace (team) to operate on, e.g. T0123456789. Use only with org-level Enterprise Grid tokens when you need to target a specific workspace; omit for single-workspace tokens."
        },
        "exclude_archived": {
          "type": "boolean",
          "examples": [
            true,
            false
          ],
          "description": "Excludes archived channels if true. The API defaults to false (archived channels are included)."
        }
      }
    }
  },
  {
    "name": "SLACK_FIND_CHANNELS",
    "toolkit": "slack",
    "description": "Find channels in a Slack workspace by any criteria - name, topic, purpose, or description. Returns channel IDs (C*/G* prefixed) required by most Slack tools — always resolve names to IDs here before passing to other tools. NOTE: This action searches channels and conversations visible to the authenticated user. Empty results may indicate: - No channels match the search query in name, topic, or purpose - The target private channel or DM is not accessible to the authenticated user because they are not a member - The connection lacks required read scopes (channels:read, groups:read, im:read, mpim:read). If empty, retry with exact_match=false or exclude_archived=false to avoid false negatives. In large workspaces, paginate using next_cursor to avoid missing matches. Check 'composio_execution_message' and 'total_channels_searched' in the response for details.",
    "requiresConfirmation": false,
    "parameters": {
      "type": "object",
      "required": [
        "query"
      ],
      "properties": {
        "limit": {
          "type": "integer",
          "default": 50,
          "examples": [
            10,
            50,
            100,
            200,
            500
          ],
          "description": "Maximum number of conversations to request from Slack in this single API page before local search filtering (1 to 999). Defaults to 50. Fewer matching channels may be returned; use response_metadata.next_cursor to search subsequent pages."
        },
        "query": {
          "type": "string",
          "examples": [
            "general",
            "#general",
            "marketing",
            "dev",
            "announcements",
            "project"
          ],
          "description": "Search query to find channels. Searches across channel name, topic, purpose, and description (case-insensitive partial matching). Leading '#' prefix is automatically stripped."
        },
        "types": {
          "type": "string",
          "default": "public_channel,private_channel",
          "examples": [
            "public_channel",
            "private_channel",
            "public_channel,private_channel"
          ],
          "description": "Comma-separated list of channel types to include: `public_channel`, `private_channel`, `mpim` (multi-person direct message), `im` (direct message). Defaults to public and private channels."
        },
        "cursor": {
          "type": "string",
          "examples": [
            "example_cursor"
          ],
          "description": "Pagination cursor from response_metadata.next_cursor of a previous response. Omit for the first page."
        },
        "team_id": {
          "type": "string",
          "examples": [
            "T1234567890",
            "T9876543210"
          ],
          "description": "ID of the Slack workspace (team) to operate on, e.g. T0123456789. Use only with org-level Enterprise Grid tokens when you need to target a specific workspace; omit for single-workspace tokens."
        },
        "exact_match": {
          "type": "boolean",
          "default": false,
          "examples": [
            true,
            false
          ],
          "description": "When true, only return channels whose name exactly matches the query (case-insensitive). Also matches against previous channel names and the 'general' flag. When false, returns partial matches across name, topic, and purpose. Defaults to false."
        },
        "member_only": {
          "type": "boolean",
          "default": false,
          "examples": [
            true,
            false
          ],
          "description": "Only return channels the user is a member of. Defaults to false."
        },
        "exclude_archived": {
          "type": "boolean",
          "default": true,
          "examples": [
            true,
            false
          ],
          "description": "Exclude archived channels from search results. Defaults to true."
        }
      }
    }
  },
  {
    "name": "NOTION_SEARCH_NOTION_PAGE",
    "toolkit": "notion",
    "description": "Searches Notion pages and databases by title. Use specific search terms to find items by title (primary approach). KNOWN LIMITATIONS: (1) Search indexing is not immediate - recently shared items may not appear. (2) Search is not exhaustive - results may be incomplete. (3) Database pages return all custom properties with full nested structures, which can create large responses for databases with many properties - use filter_properties to reduce response size. FALLBACK STRATEGY: If a specific title search returns empty results despite knowing items exist, try an empty query to list all accessible items and filter client-side.",
    "requiresConfirmation": false,
    "parameters": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "default": "",
          "description": "Text to search for in page and database titles. Use specific search terms to find items by title (primary approach). Note: Notion's search has known limitations - indexing is not immediate and recently shared items may not appear. If a specific query returns empty results, try an empty query as a fallback to list all accessible items and filter client-side."
        },
        "direction": {
          "type": "string",
          "examples": [
            "ascending",
            "descending"
          ],
          "description": "Specifies the sort direction for the results. Required if `timestamp` is provided. Valid values are `ascending` or `descending`."
        },
        "page_size": {
          "type": "integer",
          "default": 25,
          "maximum": 100,
          "minimum": 1,
          "description": "The number of items to include in the response. Must be an integer between 1 and 100, inclusive. Defaults to 25."
        },
        "timestamp": {
          "type": "string",
          "description": "The timestamp field to sort the results by. Currently, the only supported value is `last_edited_time`. If provided, `direction` must also be specified."
        },
        "filter_value": {
          "enum": [
            "page",
            "database"
          ],
          "type": "string",
          "default": "page",
          "examples": [
            "page",
            "database"
          ],
          "description": "Filters results by object type: 'page' or 'database'. Note: When searching databases, Notion's search may not find recently shared or newly created databases due to indexing delays. If specific database searches return empty results, try an empty query with filter_value='database' as a fallback to list all accessible databases."
        },
        "start_cursor": {
          "type": "string",
          "description": "An opaque cursor value from a previous response's `next_cursor` field. Must be exactly as returned by the API - do not pass page IDs, database IDs, or any other identifiers. If `None`, empty, or invalid, results start from the beginning."
        },
        "filter_property": {
          "type": "string",
          "default": "object",
          "examples": [
            "object"
          ],
          "description": "The property to filter the search results by. Currently, the only supported value is `object`, which filters by the type specified in `filter_value`. Defaults to `object`."
        },
        "filter_properties": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "List of property names to include in the response for page results. When specified, only these properties will be returned in each page's 'properties' object, reducing response size. Useful for database pages with many custom properties. If not specified, all properties are returned. Note: This filter is applied client-side after receiving the API response."
        }
      }
    }
  },
  {
    "name": "NOTION_RETRIEVE_PAGE",
    "toolkit": "notion",
    "description": "Retrieve a Notion page's properties/metadata (not block content) by page_id. Use when you have a page URL/ID and need to access its properties; for page content use block-children tools.",
    "requiresConfirmation": false,
    "parameters": {
      "type": "object",
      "required": [
        "page_id"
      ],
      "properties": {
        "page_id": {
          "type": "string",
          "examples": [
            "6c6a9b6c-12a4-4c3e-98e2-3c7a1e4f2d2a",
            "6c6a9b6c12a44c3e98e23c7a1e4f2d2a"
          ],
          "description": "The UUID of the Notion page to retrieve. Accepts both hyphenated (8-4-4-4-12) and unhyphenated (32 characters) UUID formats. IMPORTANT: Must be a PAGE ID, not a database ID. If you have a database ID, use NOTION_FETCH_DATABASE instead. This endpoint returns page properties and metadata, not page content (use block-children tools for content). For pages with properties containing more than 25 references, use NOTION_GET_PAGE_PROPERTY_ACTION to retrieve complete property values."
        }
      }
    }
  },
  {
    "name": "NOTION_CREATE_NOTION_PAGE",
    "toolkit": "notion",
    "description": "Creates a new page in a Notion workspace under a specified parent page or database. Supports creating pages with markdown content using the native markdown parameter, or as an empty page that can be populated later. PREREQUISITES: - Parent page/database must exist and be accessible in your Notion workspace - Use search_pages or list_databases first to obtain valid parent IDs LIMITATIONS: - Cannot create root-level pages (must have a parent) - May encounter conflicts if creating pages too quickly - Title-based parent search is less reliable than using UUIDs - The markdown parameter is mutually exclusive with children/content parameters",
    "requiresConfirmation": true,
    "parameters": {
      "type": "object",
      "required": [
        "parent_id",
        "title"
      ],
      "properties": {
        "icon": {
          "type": "string",
          "examples": [
            "😻",
            "🤔",
            "📄"
          ],
          "description": "An emoji to be used as the icon for the new page. Must be a single emoji character. If the title starts with this emoji, it will be stripped from the title text to prevent duplication."
        },
        "cover": {
          "type": "string",
          "pattern": "^https?://.+",
          "examples": [
            "https://www.example.com/images/cover.png"
          ],
          "description": "The URL of an image to be used as the cover for the new page. The URL must be publicly accessible."
        },
        "title": {
          "type": "string",
          "examples": [
            "My new report",
            "Project Plan Q3"
          ],
          "description": "The title of the new page to be created. If an icon emoji is provided and the title starts with the same emoji, it will be automatically removed from the title to avoid duplication."
        },
        "markdown": {
          "type": "string",
          "examples": [
            "# Meeting Notes\n\nDiscussed roadmap for Q1"
          ],
          "description": "Page content as Notion-flavored Markdown. When provided, the page will be created from this markdown string. If properties.title is omitted, the first # h1 heading will be extracted as the page title. This parameter is mutually exclusive with children and content parameters."
        },
        "parent_id": {
          "type": "string",
          "examples": [
            "59833787-2cf9-4fdf-8782-e53db20768a5",
            "598337872cf94fdf8782e53db20768a5",
            "My Project Database"
          ],
          "description": "CRITICAL: Must be either: 1) A valid Notion UUID in dashed format (8-4-4-4-12 hex characters like '59833787-2cf9-4fdf-8782-e53db20768a5') or dashless format (32 hex characters like '598337872cf94fdf8782e53db20768a5') of an existing Notion page or database. 2) The exact title of an existing page/database (less reliable - UUID strongly preferred). IMPORTANT: Always use search_pages or list_databases actions FIRST to obtain valid parent IDs. Common errors: Using malformed UUIDs, non-existent IDs, or IDs from different workspaces. Note: Root-level pages cannot be created - you must specify a parent. Also accepts 'parent_page_id' as an alias."
        }
      }
    }
  },
  {
    "name": "INSTAGRAM_GET_USER_INFO",
    "toolkit": "instagram",
    "description": "Get Instagram Business Account info including profile details and statistics. Use \"me\" to query your own authenticated account, or provide the numeric Business Account ID of an account you manage. NOTE: followers_count and follows_count are returned for your own profile (ig_user_id=\"me\"). For other accounts, follower/follow counts are surfaced through the business_discovery edge rather than this direct-node action, so they may be null here.",
    "requiresConfirmation": false,
    "parameters": {
      "type": "object",
      "properties": {
        "fields": {
          "type": "string",
          "minLength": 1,
          "description": "Optional exact comma-separated projection of Instagram user fields. Supported profile fields include id, user_id, username, name, account_type, profile_picture_url, followers_count, follows_count, and media_count. When omitted, the action uses its existing profile field defaults."
        },
        "ig_user_id": {
          "type": "string",
          "description": "Instagram Business Account ID. IMPORTANT: You can only query Business/Creator accounts that you manage through Facebook Business Manager. Use \"me\" to query your own authenticated account. To query other accounts you manage, provide their numeric Business Account ID. Arbitrary public accounts cannot be queried. If not provided, defaults to \"me\"."
        },
        "graph_api_version": {
          "type": "string",
          "default": "v21.0",
          "description": "The Facebook Graph API version to use for the request."
        }
      }
    }
  },
  {
    "name": "INSTAGRAM_GET_IG_USER_MEDIA",
    "toolkit": "instagram",
    "description": "List one cursor-paginated page of user media with selected fields; use ig_user_id='me' for the authenticated account.",
    "requiresConfirmation": false,
    "parameters": {
      "type": "object",
      "required": [
        "ig_user_id"
      ],
      "properties": {
        "after": {
          "type": "string",
          "description": "Forward-pagination cursor from paging.cursors.after in the previous response; omit for the first page."
        },
        "limit": {
          "type": "integer",
          "default": 25,
          "maximum": 100,
          "minimum": 1,
          "description": "Maximum number of media objects to return in this page (default 25, maximum 100)."
        },
        "since": {
          "type": "integer",
          "description": "Unix timestamp - filter results to media created after this time. If both 'since' and 'until' are provided, 'since' must be less than 'until'."
        },
        "until": {
          "type": "integer",
          "description": "Unix timestamp - filter results to media created before this time. If both 'since' and 'until' are provided, 'since' must be less than 'until'."
        },
        "before": {
          "type": "string",
          "description": "Cursor for backward pagination - retrieve media before this cursor"
        },
        "fields": {
          "type": "string",
          "default": "id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,username,legacy_instagram_media_id,alt_text,is_ai_generated,is_shared_to_feed,media_audio_type,view_count,reposts_count,saved_count,shares_count,total_like_count,total_comments_count,total_views_count",
          "description": "Comma-separated projection of fields to select for each media object. Available fields: id, caption, media_type, media_url, permalink, thumbnail_url, timestamp, username, comments_count, like_count, legacy_instagram_media_id, is_comment_enabled, owner, shortcode, media_product_type, alt_text, is_ai_generated, is_shared_to_feed, media_audio_type, view_count, reposts_count, saved_count, shares_count, total_like_count, total_comments_count, total_views_count, children{media_url,media_type,thumbnail_url}. Reels appear as media_type=VIDEO and media_product_type=REELS; filter both fields to identify reels. media_url is a direct file URL; permalink is the user-facing share link. Optional fields like caption and like_count may be null or absent in the response."
        },
        "ig_user_id": {
          "type": "string",
          "examples": [
            "me",
            "17841405793187218"
          ],
          "minLength": 2,
          "description": "Instagram Business or Creator Account ID. Use 'me' for the authenticated user, or provide the numeric IG User ID obtained from the Instagram Graph API (typically 17 digits, e.g., '17841405793187218'). Facebook Page IDs are not supported or automatically converted."
        },
        "graph_api_version": {
          "type": "string",
          "default": "v21.0",
          "description": "Instagram Graph API version to use (e.g., 'v21.0')"
        },
        "auto_resolve_fb_page_id": {
          "type": "boolean",
          "default": true,
          "description": "Deprecated no-op retained for backwards compatibility. On Instagram Login the host follows the token (graph.instagram.com) and Facebook Page IDs are not resolved. Provide an Instagram Business or Creator Account ID directly (or 'me')."
        }
      }
    }
  },
  {
    "name": "REDDIT_GET_REDDIT_USER_ABOUT",
    "toolkit": "reddit",
    "description": "Retrieves information about a specified Reddit user account, including karma scores and gold status. Use when you need to get profile information for any public Reddit user.",
    "requiresConfirmation": false,
    "parameters": {
      "type": "object",
      "required": [
        "username"
      ],
      "properties": {
        "username": {
          "type": "string",
          "examples": [
            "spez",
            "reddit",
            "AutoModerator",
            "me"
          ],
          "description": "The name of an existing Reddit user to retrieve information about. Do not include 'u/' prefix. Use 'me' to get information about the currently authenticated user."
        }
      }
    }
  },
  {
    "name": "REDDIT_GET",
    "toolkit": "reddit",
    "description": "Tool to retrieve a listing of Reddit posts sorted by the specified criteria (hot, new, top, rising, controversial, best). Use when you need to get posts from the Reddit front page or all of Reddit with a specific sort order. Supports pagination and time filtering for top and controversial sorts. For new controversial-post workflows, prefer GET_CONTROVERSIAL; this action retains controversial support for backward compatibility. Use GET_RANDOM for random posts.",
    "requiresConfirmation": false,
    "parameters": {
      "type": "object",
      "required": [
        "sort"
      ],
      "properties": {
        "show": {
          "type": "string",
          "description": "The string 'all' to show all posts including filtered ones."
        },
        "sort": {
          "type": "string",
          "examples": [
            "hot",
            "new",
            "top",
            "rising",
            "controversial",
            "best"
          ],
          "description": "The sorting method for results. Valid values: hot, new, top, rising, controversial, best. For new controversial-post workflows, prefer the dedicated GET_CONTROVERSIAL action; this action continues to support controversial for backward compatibility. Note: 'random' is NOT supported here - use the GET_RANDOM action instead."
        },
        "after": {
          "type": "string",
          "description": "Fullname of a thing for pagination (loads posts after this item)."
        },
        "count": {
          "type": "integer",
          "description": "A positive integer representing the number of items already seen (default: 0)."
        },
        "limit": {
          "type": "integer",
          "examples": [
            25,
            50,
            100
          ],
          "description": "The maximum number of items desired (default: 25, maximum: 100)."
        },
        "before": {
          "type": "string",
          "description": "Fullname of a thing for pagination (loads posts before this item)."
        },
        "time_filter": {
          "type": "string",
          "examples": [
            "hour",
            "day",
            "week",
            "month",
            "year",
            "all"
          ],
          "description": "Time filter for the 'top' and 'controversial' sorts. Valid values: hour, day, week, month, year, all."
        }
      }
    }
  },
  {
    "name": "TWITTER_USER_LOOKUP_ME",
    "toolkit": "twitter",
    "description": "Returns profile information for the currently authenticated X user, customizable via request fields.",
    "requiresConfirmation": false,
    "parameters": {
      "type": "object",
      "properties": {
        "expansions": {
          "type": "array",
          "items": {
            "enum": [
              "pinned_tweet_id"
            ],
            "type": "string",
            "description": "Valid expansions for the /users/me endpoint.\nAt this time, 'pinned_tweet_id' is the ONLY valid expansion for user lookup endpoints.\nNote: 'affiliation' and 'most_recent_tweet_id' are USER FIELDS (requested via user.fields), NOT expansions.\nDo NOT use tweet-related expansions like 'author_id' or 'referenced_tweets.id' - those are not valid for this endpoint."
          },
          "examples": [
            "pinned_tweet_id"
          ],
          "description": "Fields to expand for related entities. ONLY 'pinned_tweet_id' is valid for user lookup endpoints. This returns the user's pinned Tweet in the includes.tweets array. Do NOT use tweet expansions like 'author_id' or 'referenced_tweets.id' - those are not valid for this endpoint. Note: 'affiliation' and 'most_recent_tweet_id' are user fields, not expansions."
        },
        "user_fields": {
          "type": "array",
          "items": {
            "enum": [
              "affiliation",
              "connection_status",
              "created_at",
              "description",
              "entities",
              "id",
              "location",
              "most_recent_tweet_id",
              "name",
              "pinned_tweet_id",
              "profile_banner_url",
              "profile_image_url",
              "protected",
              "public_metrics",
              "receives_your_dm",
              "subscription_type",
              "url",
              "username",
              "verified",
              "verified_type",
              "withheld"
            ],
            "type": "string",
            "description": "Valid user fields for the /users/me endpoint. Note: id, name, and username are returned by default."
          },
          "examples": [
            "created_at",
            "public_metrics",
            "profile_image_url",
            "description"
          ],
          "description": "User attributes to include in the response. Valid values: affiliation, connection_status, created_at, description, entities, id, location, most_recent_tweet_id, name, pinned_tweet_id, profile_banner_url, profile_image_url, protected, public_metrics, receives_your_dm, subscription_type, url, username, verified, verified_type, withheld. Note: id, name, and username are returned by default."
        },
        "tweet_fields": {
          "type": "array",
          "items": {
            "enum": [
              "article",
              "attachments",
              "author_id",
              "card_uri",
              "context_annotations",
              "conversation_id",
              "created_at",
              "edit_controls",
              "edit_history_tweet_ids",
              "entities",
              "geo",
              "id",
              "in_reply_to_user_id",
              "lang",
              "non_public_metrics",
              "note_tweet",
              "organic_metrics",
              "possibly_sensitive",
              "promoted_metrics",
              "public_metrics",
              "referenced_tweets",
              "reply_settings",
              "scopes",
              "source",
              "text",
              "withheld"
            ],
            "type": "string"
          },
          "examples": [
            "id",
            "text",
            "created_at",
            "public_metrics"
          ],
          "description": "Tweet attributes to include when using expansions=pinned_tweet_id. Only used to get additional fields for the expanded pinned tweet. Valid values include: id, text, created_at, public_metrics, author_id, entities, etc."
        }
      }
    }
  },
  {
    "name": "TWITTER_GET_USER_POSTS",
    "toolkit": "twitter",
    "description": "Retrieves posts authored by a selected X user.",
    "requiresConfirmation": false,
    "parameters": {
      "type": "object",
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^[0-9]{1,19}$",
          "examples": [
            "2244994945"
          ],
          "description": "Numeric ID of the user whose authored posts to retrieve."
        },
        "exclude": {
          "type": "array",
          "items": {
            "enum": [
              "replies",
              "retweets"
            ],
            "type": "string"
          },
          "minItems": 1,
          "description": "Post types to exclude."
        },
        "end_time": {
          "type": "string",
          "format": "date-time",
          "description": "Latest post creation time, on or after 2010-11-06."
        },
        "since_id": {
          "type": "string",
          "pattern": "^[0-9]{1,19}$",
          "description": "Return posts newer than this numeric post ID."
        },
        "until_id": {
          "type": "string",
          "pattern": "^[0-9]{1,19}$",
          "description": "Return posts older than this numeric post ID."
        },
        "expansions": {
          "type": "array",
          "items": {
            "enum": [
              "article.cover_media",
              "article.media_entities",
              "attachments.media_keys",
              "attachments.media_source_tweet",
              "attachments.poll_ids",
              "author_id",
              "edit_history_post_ids",
              "entities.mentions.username",
              "geo.place_id",
              "in_reply_to_user_id",
              "referenced_posts",
              "username"
            ],
            "type": "string"
          },
          "minItems": 1,
          "description": "Related objects to expand."
        },
        "start_time": {
          "type": "string",
          "format": "date-time",
          "description": "Earliest post creation time, on or after 2010-11-06."
        },
        "max_results": {
          "type": "integer",
          "maximum": 100,
          "minimum": 5,
          "description": "Maximum posts to return on this page, from 5 through 100."
        },
        "poll_fields": {
          "type": "array",
          "items": {
            "enum": [
              "duration_minutes",
              "end_datetime",
              "id",
              "options",
              "voting_status"
            ],
            "type": "string"
          },
          "minItems": 1,
          "description": "Fields for expanded polls."
        },
        "user_fields": {
          "type": "array",
          "items": {
            "enum": [
              "active_follower_count",
              "confirmed_email",
              "connection_status",
              "created_at",
              "description",
              "entities",
              "id",
              "location",
              "is_identity_verified",
              "name",
              "parody",
              "profile_banner_url",
              "profile_image_url",
              "protected",
              "public_metrics",
              "receives_your_dm",
              "subscriber_count",
              "subscribes_to_you",
              "subscription",
              "subscription_type",
              "url",
              "username",
              "verified",
              "verified_followers_count",
              "verified_type",
              "withheld"
            ],
            "type": "string"
          },
          "minItems": 1,
          "description": "Fields for expanded users."
        },
        "media_fields": {
          "type": "array",
          "items": {
            "enum": [
              "alt_text",
              "duration_ms",
              "height",
              "media_key",
              "non_public_metrics",
              "organic_metrics",
              "preview_image_url",
              "promoted_metrics",
              "public_metrics",
              "type",
              "url",
              "variants",
              "width"
            ],
            "type": "string"
          },
          "minItems": 1,
          "description": "Fields for expanded media."
        },
        "place_fields": {
          "type": "array",
          "items": {
            "enum": [
              "contained_within",
              "country",
              "country_code",
              "full_name",
              "geo",
              "id",
              "name",
              "place_type"
            ],
            "type": "string"
          },
          "minItems": 1,
          "description": "Fields for expanded places."
        },
        "tweet_fields": {
          "type": "array",
          "items": {
            "enum": [
              "article",
              "article_title",
              "attachments",
              "card_uri",
              "community_id",
              "context_annotations",
              "conversation_id",
              "created_at",
              "display_text_range",
              "edit_controls",
              "entities",
              "geo",
              "id",
              "lang",
              "matched_media_notes",
              "media_metadata",
              "non_public_metrics",
              "note_post",
              "note_request_suggestions",
              "organic_metrics",
              "paid_partnership",
              "possibly_sensitive",
              "promoted_metrics",
              "public_metrics",
              "reply_settings",
              "scopes",
              "source",
              "suggested_source_links",
              "suggested_source_links_with_counts",
              "text",
              "withheld"
            ],
            "type": "string"
          },
          "minItems": 1,
          "description": "Post fields to include."
        },
        "pagination_token": {
          "type": "string",
          "minLength": 1,
          "description": "Token from meta.next_token for the next page."
        }
      }
    }
  },
  {
    "name": "TRELLO_GET_MEMBERS_BOARDS_BY_ID_MEMBER",
    "toolkit": "trello",
    "description": "Retrieves board-level details (not lists/cards) for Trello boards associated with a member ID or username, allowing extensive customization of the returned data.",
    "requiresConfirmation": false,
    "parameters": {
      "type": "object",
      "properties": {
        "lists": {
          "type": "string",
          "default": "open",
          "examples": [
            "open",
            "all",
            "none",
            "closed"
          ],
          "description": "Filters the lists returned for each board. Valid values: 'all', 'closed', 'none', 'open'."
        },
        "fields": {
          "type": "string",
          "default": "all",
          "examples": [
            "all",
            "name,url",
            "prefs,shortUrl"
          ],
          "description": "Specifies the fields to return for each board. Accepts 'all' or a comma-separated list of field names. Possible field names: 'closed', 'dateLastActivity', 'dateLastView', 'desc', 'descData', 'idOrganization', 'invitations', 'invited', 'labelNames', 'memberships', 'name', 'pinned', 'powerUps', 'prefs', 'shortLink', 'shortUrl', 'starred', 'subscribed', 'url'."
        },
        "filter": {
          "type": "string",
          "default": "all",
          "examples": [
            "all",
            "open,starred",
            "organization,public"
          ],
          "description": "Filters the boards returned. Valid values are 'all' or a comma-separated list of: 'closed', 'members', 'open', 'organization', 'pinned', 'public', 'starred', 'unpinned'."
        },
        "actions": {
          "type": "string",
          "examples": [
            "all",
            "commentCard,createList"
          ],
          "description": "Specifies which actions to return for each board. Accepts 'all' or a comma-separated list of action types. Possible action types: 'addAttachmentToCard', 'addChecklistToCard', 'addMemberToBoard', 'addMemberToCard', 'addMemberToOrganization', 'addToOrganizationBoard', 'commentCard', 'convertToCardFromCheckItem', 'copyBoard', 'copyCard', 'copyCommentCard', 'createBoard', 'createCard', 'createList', 'createOrganization', 'deleteAttachmentFromCard', 'deleteBoardInvitation', 'deleteCard', 'deleteOrganizationInvitation', 'disablePowerUp', 'emailCard', 'enablePowerUp', 'makeAdminOfBoard', 'makeNormalMemberOfBoard', 'makeNormalMemberOfOrganization', 'makeObserverOfBoard', 'memberJoinedTrello', 'moveCardFromBoard', 'moveCardToBoard', 'moveListFromBoard', 'moveListToBoard', 'removeChecklistFromCard', 'removeFromOrganizationBoard', 'removeMemberFromCard', 'unconfirmedBoardInvitation', 'unconfirmedOrganizationInvitation', 'updateBoard', 'updateCard', 'updateCard:closed', 'updateCard:desc', 'updateCard:idList', 'updateCard:name', 'updateCheckItemStateOnCard', 'updateChecklist', 'updateList', 'updateList:closed', 'updateList:name', 'updateMember', 'updateOrganization'."
        },
        "idMember": {
          "type": "string",
          "default": "me",
          "examples": [
            "me",
            "johndoe",
            "60d5f1b3e4b5f67890abcdef"
          ],
          "description": "The ID or username of the Trello member. Use 'me' to refer to the authenticated user. Defaults to 'me' if not provided."
        },
        "memberships": {
          "type": "string",
          "default": "none",
          "examples": [
            "all",
            "me",
            "admin,normal"
          ],
          "description": "Filters boards by the member's membership type. Accepts 'all' or a comma-separated list of: 'active', 'admin', 'deactivated', 'me', 'normal'."
        },
        "organization": {
          "type": "string",
          "examples": [
            "true",
            "false"
          ],
          "description": "Determines whether to return organization data for boards. Valid values: 'true' or 'false'."
        },
        "action_fields": {
          "type": "string",
          "default": "all",
          "examples": [
            "all",
            "data,date",
            "idMemberCreator"
          ],
          "description": "Specifies fields for returned actions if actions are requested. Accepts 'all' or a comma-separated list: 'data', 'date', 'idMemberCreator', 'type'."
        },
        "actions_limit": {
          "type": "string",
          "default": "5",
          "examples": [
            "50",
            "100",
            "0"
          ],
          "description": "The maximum number of actions to return, from 0 to 1000."
        },
        "actions_since": {
          "type": "string",
          "examples": [
            "2023-01-01T00:00:00Z",
            "lastView",
            "null"
          ],
          "description": "Filters actions to those that occurred after this date, or accepts 'null' or 'lastView'."
        },
        "actions_format": {
          "type": "string",
          "default": "list",
          "examples": [
            "list",
            "count",
            "minimal"
          ],
          "description": "The format for returned actions. Valid values: 'count', 'list', or 'minimal'."
        },
        "actions_entities": {
          "type": "string",
          "examples": [
            "true",
            "false"
          ],
          "description": "Determines whether to return entity data for actions. Valid values: 'true' or 'false'."
        },
        "organization_fields": {
          "type": "string",
          "default": "name and displayName",
          "examples": [
            "all",
            "name,displayName",
            "products,url,idBoards"
          ],
          "description": "Specifies the fields to return for the organization if 'organization' is 'true'. Accepts 'all' or a comma-separated list of field names. Possible field names: 'billableMemberCount', 'desc', 'descData', 'displayName', 'idBoards', 'invitations', 'invited', 'logoHash', 'memberships', 'name', 'powerUps', 'prefs', 'premiumFeatures', 'products', 'url', 'website'."
        }
      }
    }
  },
  {
    "name": "TRELLO_GET_BOARDS_LISTS_BY_ID_BOARD",
    "toolkit": "trello",
    "description": "Retrieves lists from a specified Trello board, with options to filter lists and include card details.",
    "requiresConfirmation": false,
    "parameters": {
      "type": "object",
      "required": [
        "idBoard"
      ],
      "properties": {
        "cards": {
          "type": "string",
          "default": "none",
          "examples": [
            "none",
            "open",
            "all",
            "closed"
          ],
          "description": "Determines which cards should be returned within the lists. Valid values are 'all', 'closed', 'none', or 'open'."
        },
        "fields": {
          "type": "string",
          "default": "all",
          "examples": [
            "all",
            "name,pos",
            "idBoard,subscribed"
          ],
          "description": "Specifies the fields of the lists to be returned. Use 'all' for all fields, or provide a comma-separated list of specific fields. Valid fields include: closed, idBoard, name, pos, or subscribed."
        },
        "filter": {
          "type": "string",
          "default": "open",
          "examples": [
            "open",
            "all",
            "closed"
          ],
          "description": "Filters the lists to be returned based on their status. Valid values are 'all', 'closed', 'none', or 'open'."
        },
        "idBoard": {
          "type": "string",
          "examples": [
            "60d5f2f1c8a8b4002b8f0123",
            "TH6F0pTM"
          ],
          "description": "The ID of the Trello board. Valid formats: 24-character hexadecimal ID (e.g., '60d5f2f1c8a8b4002b8f0123') OR 8-character shortLink (e.g., 'TH6F0pTM'). Human-readable board names or URL slugs (e.g., 'my-board', 'tech-jcorp') are NOT valid identifiers. In the URL 'trello.com/b/TH6F0pTM/my-board', 'TH6F0pTM' is the valid shortLink, while 'my-board' is just a slug and cannot be used. To find your board ID or shortLink: use TRELLO_GET_MEMBERS_BOARDS_BY_ID_MEMBER to list your boards, or look at the board URL in your browser."
        },
        "card_fields": {
          "type": "string",
          "default": "all",
          "examples": [
            "all",
            "name,desc,due",
            "idShort,labels"
          ],
          "description": "Specifies the fields of cards to be returned if the 'cards' parameter is not 'none'. Use 'all' for all fields, or provide a comma-separated list of specific fields. Valid fields include: badges, checkItemStates, closed, dateLastActivity, desc, descData, due, email, idAttachmentCover, idBoard, idChecklists, idLabels, idList, idMembers, idMembersVoted, idShort, labels, manualCoverAttachment, name, pos, shortLink, shortUrl, subscribed, or url."
        }
      }
    }
  },
  {
    "name": "TRELLO_ADD_CARDS",
    "toolkit": "trello",
    "description": "Creates a new card in a Trello list. Only `idList` is required; `idBoard` is optional as the API determines the board from the list.",
    "requiresConfirmation": true,
    "parameters": {
      "type": "object",
      "required": [
        "idList"
      ],
      "properties": {
        "due": {
          "type": "string",
          "examples": [
            "2024-12-31T23:59:59.999Z",
            "null"
          ],
          "description": "Due date for the card (date string or 'null' to remove)."
        },
        "pos": {
          "type": "string",
          "examples": [
            "top",
            "bottom",
            "16384.0"
          ],
          "description": "Position in list: 'top', 'bottom', or a positive float."
        },
        "desc": {
          "type": "string",
          "examples": [
            "This is a sample card description."
          ],
          "description": "Card description (0-16384 characters)."
        },
        "name": {
          "type": "string",
          "examples": [
            "My New Task Card"
          ],
          "description": "Name/title for the card. Highly recommended for new cards. If omitted, a blank title is created. When using 'idCardSource' to copy a card, the name is copied from the source unless overridden here."
        },
        "closed": {
          "type": "string",
          "examples": [
            "true",
            "false"
          ],
          "description": "Archive (close) the card. Valid values: 'true', 'false'."
        },
        "idList": {
          "type": "string",
          "pattern": "^[a-fA-F0-9]{24}$",
          "examples": [
            "60d5f0f5b3f3d50029f7a3b2"
          ],
          "description": "ID of the list to add the card to. Must be a 24-character hexadecimal string."
        },
        "idBoard": {
          "type": "string",
          "examples": [
            "60d5f0f5b3f3d50029f7a3b1"
          ],
          "description": "ID of the board for the card. Must be a 24-character hexadecimal string. Optional - the API automatically determines the board from idList."
        },
        "idLabels": {
          "type": "string",
          "examples": [
            "60d5f0f5b3f3d50029f7a3c3,60d5f0f5b3f3d50029f7a3c4"
          ],
          "description": "Comma-separated list of label IDs to add. Each ID must be a 24-character hexadecimal string."
        },
        "idMembers": {
          "type": "string",
          "examples": [
            "60d5f0f5b3f3d50029f7a3c5,60d5f0f5b3f3d50029f7a3c6"
          ],
          "description": "Comma-separated list of member IDs to assign. Each ID must be a 24-character hexadecimal string."
        },
        "urlSource": {
          "type": "string",
          "examples": [
            "https://trello.com/c/examplecard",
            "https://example.com"
          ],
          "description": "URL to attach to the card. If a Trello card URL is provided, the card is copied from that source. Use 'null' or omit if not needed."
        },
        "fileSource": {
          "type": "string",
          "examples": [
            "[binary file data]"
          ],
          "description": "Binary data of a file to attach."
        },
        "subscribed": {
          "type": "string",
          "examples": [
            "true",
            "false"
          ],
          "description": "Subscribe user to the card. Valid values: 'true', 'false'."
        },
        "idCardSource": {
          "type": "string",
          "examples": [
            "60d5f0f5b3f3d50029f7a3c2"
          ],
          "description": "ID of an existing card to copy. Must be a 24-character hexadecimal string. When provided, the new card inherits name and other properties from the source card."
        },
        "keepFromSource": {
          "type": "string",
          "examples": [
            "all",
            "attachments,checklists,labels"
          ],
          "description": "If using `idCardSource`, properties to copy: 'all' or comma-separated (e.g., 'attachments', 'checklists', 'due')."
        },
        "idAttachmentCover": {
          "type": "string",
          "examples": [
            "60d5f0f5b3f3d50029f7a3c1",
            "null"
          ],
          "description": "ID of an image attachment on this card for its cover, or 'null' for no cover. Must be a 24-character hexadecimal string or 'null'."
        }
      }
    }
  },
  {
    "name": "JIRA_SEARCH_ISSUES",
    "toolkit": "jira",
    "description": "Advanced Jira issue search supporting structured filters and raw JQL. At least one filter parameter (e.g., jql, project_key, updated_after) is required; calls with no parameters will be rejected.",
    "requiresConfirmation": false,
    "parameters": {
      "type": "object",
      "properties": {
        "jql": {
          "type": "string",
          "examples": [
            "project = PROJ AND status = 'To Do'",
            "status IN ('Open', 'In Progress', 'To Do')",
            "assignee = currentUser() AND priority = High",
            "labels IN ('urgent', 'customer-facing')",
            "summary ~ 'bug' OR description ~ 'error'",
            "project = PROJ AND (status = 'Open' OR status = 'In Progress')",
            "ORDER BY created DESC"
          ],
          "description": "Raw JQL (Jira Query Language) query for advanced users. Takes precedence over filters. Can be a complete JQL query with filters and/or ORDER BY clause, or just an ORDER BY clause. CRITICAL JQL SYNTAX RULES - Every comparison needs field + operator + value: (1) WRONG: '(\"val1\" OR \"val2\")' - bare values without field reference cause 'Expecting operator' errors. (2) RIGHT: 'status = \"val1\" OR status = \"val2\"' - each value has field and operator. (3) BETTER: 'status IN (\"val1\", \"val2\", \"val3\")' - use IN for multiple values on same field. (4) Text search uses ~: 'summary ~ \"keyword\"' or 'text ~ \"keyword\"'. (5) Valid operators: =, !=, <, >, <=, >=, ~, !~, IN, NOT IN, IS, IS NOT. COMMON MISTAKE: Do NOT pass ('value1' OR 'value2') - this is invalid. Instead use: field IN ('value1', 'value2') or field = 'value1' OR field = 'value2'."
        },
        "fields": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "examples": [
            [
              "summary",
              "status",
              "assignee",
              "reporter",
              "project",
              "issuetype",
              "priority",
              "labels",
              "components",
              "fixVersions",
              "created",
              "updated",
              "duedate"
            ]
          ],
          "description": "List of fields to return for each issue (for example: summary, status, assignee). If omitted, a sensible default set is requested to populate common fields."
        },
        "labels": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "examples": [
            [
              "urgent",
              "customer-facing"
            ],
            [
              "backend"
            ]
          ],
          "description": "Filter by labels (all labels must match)."
        },
        "assignee": {
          "type": "string",
          "examples": [
            "712020:4c3c027d-64e2-4d40-b532-2ae45982b4e1",
            "john.doe@company.com",
            "John Doe",
            "unassigned"
          ],
          "description": "Filter by assignee. Can be account ID (e.g., '712020:abc...'), email (e.g., 'john@company.com'), display name (e.g., 'John Doe'), or 'unassigned'."
        },
        "max_results": {
          "type": "integer",
          "default": 20,
          "examples": [
            5,
            10,
            25,
            50
          ],
          "description": "Maximum number of issues to return per page. Capped at 100 per page; total results per JQL query capped at ~10,000. Use next_page_token to paginate."
        },
        "project_key": {
          "type": "string",
          "examples": [
            "PROJ",
            "TEST"
          ],
          "description": "Filter by project key (e.g., 'PROJ')."
        },
        "text_search": {
          "type": "string",
          "examples": [
            "authentication",
            "database connection"
          ],
          "description": "Search in summary and description text."
        },
        "created_after": {
          "type": "string",
          "examples": [
            "2024-01-01",
            "2024-06-15",
            "-30m",
            "-7d",
            "-1w",
            "-1M"
          ],
          "description": "Filter issues created after this date. Supports YYYY-MM-DD format or relative dates like '-30m' (last 30 minutes), '-7d' (last 7 days), '-1w' (last week), '-1M' (last month)."
        },
        "updated_after": {
          "type": "string",
          "examples": [
            "2024-01-01",
            "2024-06-15",
            "-30m",
            "-7d",
            "-1w",
            "-1M"
          ],
          "description": "Filter issues updated after this date. Supports YYYY-MM-DD format or relative dates like '-30m' (last 30 minutes), '-7d' (last 7 days), '-1w' (last week), '-1M' (last month)."
        },
        "created_before": {
          "type": "string",
          "examples": [
            "2024-12-31",
            "2024-06-15"
          ],
          "description": "Filter issues created before this date (YYYY-MM-DD format)."
        },
        "updated_before": {
          "type": "string",
          "examples": [
            "2024-12-31",
            "2024-06-15"
          ],
          "description": "Filter issues updated before this date (YYYY-MM-DD format)."
        },
        "next_page_token": {
          "type": "string",
          "examples": [
            "eyJvZmZzZXQiOjEwMH0="
          ],
          "description": "Cursor token used to fetch the next page when using enhanced search. Tokens returned by this action include the original search context and can be passed alone. Raw Jira nextPageToken values require the same JQL or filters used for the original search."
        },
        "sprint_id_or_name": {
          "type": "string",
          "examples": [
            "123",
            "Sprint 1",
            "Release Sprint"
          ],
          "description": "Filter by sprint. Can be sprint ID (e.g., '123') or name (e.g., 'Sprint 1', 'Release Sprint')."
        },
        "status_id_or_name": {
          "type": "string",
          "examples": [
            "10001",
            "10009",
            "To Do",
            "In Progress",
            "Done"
          ],
          "description": "Filter by status. Can be either a status ID (e.g., '10001') or name (e.g., 'To Do', 'In Progress', 'Done')."
        },
        "preserved_order_by": {
          "type": "string",
          "description": "Internal: preserved ORDER BY clause from ORDER-BY-only JQL input"
        },
        "priority_id_or_name": {
          "type": "string",
          "examples": [
            "1",
            "2",
            "3",
            "High",
            "Medium",
            "Low"
          ],
          "description": "Filter by priority. Can be either a priority ID (e.g., '1', '2') or name (e.g., 'High', 'Medium', 'Low')."
        },
        "issue_type_id_or_name": {
          "type": "string",
          "examples": [
            "10001",
            "10002",
            "Bug",
            "Task",
            "Story",
            "Epic"
          ],
          "description": "Filter by issue type. Can be either an issue type ID (e.g., '10001') or name (e.g., 'Bug', 'Task', 'Story')."
        }
      }
    }
  },
  {
    "name": "JIRA_CREATE_ISSUE",
    "toolkit": "jira",
    "description": "Creates a new Jira issue (e.g., bug, task, story) in a specified project. IMPORTANT: Different Jira projects may have custom required fields beyond the standard ones (summary, project_key, issue_type). If issue creation fails with 'field X is required', use JIRA_GET_CREATE_METADATA_ISSUE_TYPE_FIELDS (requires projectIdOrKey and issueTypeId parameters) to discover available fields for your project, or check your Jira project's configuration. Custom fields can be provided via the 'additional_properties' parameter as a JSON string (e.g., '{\"customfield_12345\": \"value\"}'). Rapid bulk creation may trigger HTTP 429 rate limiting; throttle calls and use exponential backoff on 429 responses.",
    "requiresConfirmation": true,
    "parameters": {
      "type": "object",
      "required": [
        "project_key",
        "summary",
        "issue_type"
      ],
      "properties": {
        "labels": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "examples": [
            [
              "bug",
              "critical",
              "frontend"
            ]
          ],
          "description": "List of labels to categorize the issue; new labels are created if they don't exist."
        },
        "parent": {
          "type": "string",
          "examples": [
            "PROJ-123",
            "KAN-45",
            "10001"
          ],
          "description": "Parent issue key (e.g., 'PROJ-123') or issue ID. IMPORTANT: This field should ONLY be used when creating sub-task issue types (e.g., 'Sub-task', 'Subtask'). It is required for sub-tasks. Jira enforces strict hierarchy rules: standard issue types (Task, Story, Bug) can ONLY have Sub-tasks as children, not other standard issues. Epics can have Stories/Tasks/Bugs as children. Attempting to set a parent on a non-sub-task issue type or using an incompatible parent-child combination will result in a hierarchy error. The parent must be an existing issue in the same project. NOTE: Alternative field names 'parent_key' and 'parent_id' are also accepted and will be automatically mapped to this field."
        },
        "summary": {
          "type": "string",
          "examples": [
            "Fix login bug",
            "Add new dashboard feature",
            "Update API documentation"
          ],
          "description": "REQUIRED. Brief, descriptive title for the issue. This is the main headline that will appear in Jira (e.g., 'Fix login button not working', 'Add user profile page')."
        },
        "assignee": {
          "type": "string",
          "examples": [
            "712020:4c0007e1-3330-434a-8522-653bb3730e6b",
            "5b10a2844c20165700ede21g"
          ],
          "description": "Account ID of the user to assign the issue to. Must be a valid Jira account ID in one of these formats: (1) Cloud format with tenant ID and UUID: '712020:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', or (2) Legacy 24-character hex string: '5b10a2844c20165700ede21g'. IMPORTANT: Do NOT pass email addresses here - use assignee_name field for emails. The account ID is validated to ensure the user exists and can be assigned to issues in the target project. Use JIRA_FIND_USERS to get valid account IDs. Takes precedence over assignee_name if both are provided. NOTE: Some Jira projects (especially Jira Service Management/Service Desk projects) may not allow setting the assignee at issue creation time because the field isn't on the project's create screen. If this occurs, the issue will be created successfully without the assignee, and you'll need to set the assignee separately using JIRA_ASSIGN_ISSUE after creation."
        },
        "due_date": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}$",
          "examples": [
            "2023-12-31"
          ],
          "description": "Expected resolution date in YYYY-MM-DD format."
        },
        "priority": {
          "type": "string",
          "examples": [
            "1",
            "2",
            "3"
          ],
          "description": "Priority level for the issue. Can be either a priority name or a valid priority ID from the Jira instance. IMPORTANT: Priority names are completely instance-specific and vary by Jira configuration (e.g., some instances use 'Highest'/'High'/'Medium'/'Low'/'Lowest', while others use 'P0'/'P1'/'P2'/'P3'/'P4', or custom names). It is strongly recommended to either: (1) check available priorities for your instance first using JIRA_GET_ISSUE_EDIT_META or by inspecting existing issues, or (2) omit this field if unsure. When the global priority endpoint is available, the value is validated against available priorities. If validation is unavailable (404), the value is passed through to Jira for validation."
        },
        "reporter": {
          "type": "string",
          "examples": [
            "5b10a2844c20165700ede21g"
          ],
          "description": "Account ID of the user reporting the issue. Defaults to the API request user if unspecified."
        },
        "versions": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "examples": [
            [
              "10000",
              "10001"
            ]
          ],
          "description": "List of IDs for versions affected by this issue; versions must exist in the project."
        },
        "sprint_id": {
          "type": "integer",
          "examples": [
            123,
            456
          ],
          "description": "ID of the sprint to assign this issue to. The issue will be added to the specified sprint if provided."
        },
        "components": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "examples": [
            [
              "10000",
              "10001"
            ]
          ],
          "description": "List of component IDs (e.g., '10000'); components must already exist in the project."
        },
        "issue_type": {
          "type": "string",
          "examples": [
            "Task",
            "Story",
            "Epic",
            "10001"
          ],
          "description": "REQUIRED. Type of the issue - must be valid for the target project as available types vary by project configuration. CRITICAL: Always use JIRA_GET_ISSUE_TYPES to check valid types for your project BEFORE creating issues. Can be either a type name (e.g., 'Task', 'Story', 'Epic') or type ID (e.g., '10001'). Common types include Task, Story, Epic, and Bug, but NOT ALL projects support all types. Issue type names are localized based on your Jira instance's language settings (e.g., 'Task' in English, 'Задача' in Russian, 'Tâche' in French). Using the issue type ID is language-independent and more reliable."
        },
        "description": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "object",
              "additionalProperties": true
            }
          ],
          "examples": [
            "Login page is not working when clicking submit button after entering valid credentials.",
            "**Critical Bug**: The `user.login()` method fails when processing valid credentials. See [documentation](https://docs.example.com) for details."
          ],
          "description": "Detailed description of the issue. Accepts either: (1) A plain text or Markdown string (converted to ADF internally), or (2) A pre-formatted Atlassian Document Format (ADF) dict with keys 'type'='doc', 'version'=1, and 'content' array. When passing ADF directly, formatting is preserved as-is."
        },
        "environment": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "object",
              "additionalProperties": true
            }
          ],
          "examples": [
            "Production Build 2.3.1",
            "**Staging Environment**: Version `v2.3.1-rc1` deployed on server `staging-01`"
          ],
          "description": "Environment details. Accepts either: (1) A plain text or Markdown string (converted to ADF internally), or (2) A pre-formatted Atlassian Document Format (ADF) dict with keys 'type'='doc', 'version'=1, and 'content' array. When passing ADF directly, formatting is preserved as-is."
        },
        "project_key": {
          "type": "string",
          "examples": [
            "KAN",
            "DEV",
            "PROJ"
          ],
          "description": "REQUIRED. Key of the Jira project where the issue will be created (e.g., 'KAN', 'DEV', 'PROJ'). This is the short uppercase code that appears in issue keys like 'PROJ-123'. Must be an existing project key in your Jira instance. Use JIRA_GET_ALL_PROJECTS to list available projects if you don't know the key."
        },
        "fix_versions": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "examples": [
            [
              "10000",
              "10001"
            ]
          ],
          "description": "List of IDs for versions where the issue is/will be fixed; versions must exist in the project."
        },
        "assignee_name": {
          "type": "string",
          "examples": [
            "john.doe@company.com",
            "John Doe",
            "rickard",
            "test@example.org"
          ],
          "description": "Name or email of the user to assign the issue to. Can be either an email address (e.g., 'john@company.com') or display name (e.g., 'John Doe'). The system will auto-detect the type and search accordingly. Ignored if assignee (account ID) is also provided. NOTE: Slack user IDs (e.g., 'U02QWF25EQ6') are not supported - use the Jira user's email, display name, or account ID instead. NOTE: Some Jira projects (especially Jira Service Management/Service Desk projects) may not allow setting the assignee at issue creation time because the field isn't on the project's create screen. If this occurs, the issue will be created successfully without the assignee, and you'll need to set the assignee separately using JIRA_ASSIGN_ISSUE after creation."
        },
        "additional_properties": {
          "type": "string",
          "examples": [
            "{\"customfield_10104\": 5}",
            "{\"customfield_10104\": 8, \"customfield_10200\": \"Custom value\"}",
            "{\"customfield_10469\": \"Multi-line text that will be converted to ADF\"}"
          ],
          "description": "JSON string of additional fields to set on the issue. Use this for custom fields or any fields not covered by the standard parameters (e.g., Story Points, custom text fields, etc.). Format: '{\"customfield_10104\": 5, \"customfield_10200\": \"value\"}'. Rich text custom fields (textarea type) accept plain text or Markdown - they are automatically converted to Atlassian Document Format (ADF). You can also pass ADF directly as a JSON object. Use JIRA_GET_CREATE_METADATA_ISSUE_TYPE_FIELDS (requires projectIdOrKey and issueTypeId parameters) to discover available custom fields and their IDs - this is the recommended tool for creation-specific metadata. NOTE: The 'resolution' field cannot be set at issue creation - it can only be set during workflow transitions (e.g., when moving an issue to Done/Closed status). If 'resolution' is included, it will be automatically filtered out. IMPORTANT: Keys must use numeric IDs (e.g., 'customfield_10104'), NOT display names — using display names causes 400 Unknown field errors."
        }
      }
    }
  },
  {
    "name": "JIRA_EDIT_ISSUE",
    "toolkit": "jira",
    "description": "Updates an existing Jira issue with field values and operations. Supports direct field parameters (summary, description, assignee, priority, etc.) that are merged with the fields parameter. Direct parameters take precedence.",
    "requiresConfirmation": true,
    "parameters": {
      "type": "object",
      "required": [
        "issue_id_or_key"
      ],
      "properties": {
        "fields": {
          "type": "string",
          "examples": [
            "{\"summary\": \"New summary\", \"description\": \"New description\"}",
            "{\"assignee\": \"john.doe@company.com\"}",
            "{\"assignee\": {\"accountId\": \"5b10a2844c20165700ede21g\"}}",
            "{\"assignee\": null}",
            "{\"customfield_10469\": \"Plain text that will be converted to ADF\"}"
          ],
          "description": "JSON string of fields for direct updates (e.g., summary, description). When including assignee in this object, you may provide either: (a) an accountId object '{\"assignee\": {\"accountId\": \"<id>\"}}', (b) a string email/display name '{\"assignee\": \"user@example.com\"}' or '{\"assignee\": \"Full Name\"}', or (c) null to unassign. String values are resolved to accountId automatically. See Jira's 'edit issue metadata' for available fields. Use `update` for more complex operations like list modifications. IMPORTANT: The 'status' field cannot be updated via this action - use JIRA_TRANSITION_ISSUE action instead to change issue status. Rich text fields (description, environment, and custom textarea fields) support plain text or Markdown - they are automatically converted to Atlassian Document Format (ADF). You can also pass ADF directly as a JSON object."
        },
        "labels": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "examples": [
            [
              "bug",
              "critical",
              "frontend"
            ],
            [
              "enhancement",
              "ui"
            ]
          ],
          "description": "List of labels to set for the issue (replaces existing labels). New labels are created if they don't exist."
        },
        "update": {
          "type": "string",
          "examples": [
            "{\"labels\": [{\"add\": \"triaged\"}, {\"remove\": \"blocker\"}]}"
          ],
          "description": "JSON string for granular field operations (e.g., adding/removing labels, modifying list items). See Jira documentation for operation structure."
        },
        "summary": {
          "type": "string",
          "examples": [
            "Fix login bug",
            "Update user documentation"
          ],
          "description": "Brief, descriptive title for the issue."
        },
        "assignee": {
          "type": "string",
          "examples": [
            "5b10a2844c20165700ede21g",
            "john.doe@company.com",
            "John Doe",
            "hello@composio.dev",
            "",
            null
          ],
          "description": "User to assign the issue to. Can be either an account ID (e.g., '5b10a2844c20165700ede21g') or name/email (e.g., 'john@company.com', 'John Doe'). When user email visibility is restricted, account ID is required. The system will auto-detect the type and search accordingly. Provide null or an empty string to unassign. Prefer using account ID when available to avoid visibility restrictions."
        },
        "due_date": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}$",
          "examples": [
            "2023-12-31",
            null
          ],
          "description": "Expected resolution date in YYYY-MM-DD format. Use null to remove due date."
        },
        "description": {
          "type": "string",
          "examples": [
            "Login page is not working when clicking submit button after entering valid credentials.",
            "**Critical Bug**: The `user.login()` method fails when processing valid credentials. See [documentation](https://docs.example.com) for details."
          ],
          "description": "Detailed description of the issue. Supports Markdown formatting including **bold**, *italic*, `code`, links [text](url), and lists. Note: Jira enforces size limits on the description field (typically ~32,767 characters, varies by instance). For very large content, consider splitting across comments or using attachments."
        },
        "notify_users": {
          "type": "boolean",
          "default": true,
          "description": "If true, sends notification email to watchers. Setting to `False` requires admin or project admin permissions."
        },
        "return_issue": {
          "type": "boolean",
          "default": false,
          "description": "If true, response includes full updated issue details; if false, response is minimal."
        },
        "issue_id_or_key": {
          "type": "string",
          "examples": [
            "PROJ-123",
            "10000"
          ],
          "description": "ID or key of the Jira issue to be edited."
        },
        "sprint_id_or_name": {
          "type": "string",
          "examples": [
            "123",
            "456",
            "Sprint 1",
            "Release Sprint",
            "Current Sprint"
          ],
          "description": "Sprint to assign this issue to. Can be either a sprint ID (e.g., '123', '456') or sprint name (e.g., 'Sprint 1', 'Release Sprint'). The sprint must exist and be accessible. Use JIRA_LIST_SPRINTS to find available sprints."
        },
        "priority_id_or_name": {
          "type": "string",
          "examples": [
            "1",
            "2",
            "3",
            "High",
            "Medium",
            "Low"
          ],
          "description": "Priority level for the issue. Can be either a priority ID (e.g., '1', '2') or priority name (e.g., 'High', 'Medium', 'Low')."
        },
        "additional_properties": {
          "type": "object",
          "examples": [
            {
              "customfield_12345": "Custom value"
            },
            {
              "components": [
                {
                  "name": "Backend"
                }
              ]
            }
          ],
          "description": "Additional properties to include in the request body. This can be used to pass extra fields supported by the Jira API that are not explicitly defined, such as custom fields or other issue properties. These are merged into the 'fields' object in the request. Format: {'customfield_12345': 'value', 'components': [{'name': 'Backend'}]}.",
          "additionalProperties": true
        },
        "override_editable_flag": {
          "type": "boolean",
          "default": false,
          "description": "If true, bypasses editable flag restrictions. Requires admin permissions."
        },
        "override_screen_security": {
          "type": "boolean",
          "default": false,
          "description": "If true, bypasses screen security restrictions. Requires admin permissions."
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "SLACK_SEND_MESSAGE",
    "toolkit": "slack",
    "description": "Posts a message to a Slack channel, DM, or private group. Provide exactly one visible content mode: `markdown_text` for normal Markdown content, or `blocks` for raw Slack Block Kit layouts. Use `fallback_text` only with `blocks`; it maps to Slack's top-level `text` fallback. Fails with `not_in_channel`, `channel_not_found`, or `channel_is_archived` if the bot lacks access. Rate-limited at ~1 req/sec (HTTP 429, honor `Retry-After`). Not idempotent — duplicate calls post duplicate messages.",
    "requiresConfirmation": true,
    "parameters": {
      "type": "object",
      "properties": {
        "blocks": {
          "type": "array",
          "description": "Use this instead of `markdown_text` only when you need Slack Block Kit capabilities that Markdown cannot express: buttons, approval/reject actions, select menus, checkboxes, radio buttons, date/time pickers, overflow menus, interactive workflow payloads, section accessories, image/video blocks, context rows, two-column fields, multiple action buttons in one row, or rich card-like layouts. Provide raw Slack Block Kit JSON as an array. For normal prose generated by an LLM inside a blocks payload, prefer a Slack markdown block: {'type': 'markdown', 'text': '# Heading\\n\\nBody text'}. Do not use this together with `markdown_text`. If these blocks are the visible content, provide `fallback_text` when notification/accessibility fallback matters.",
          "title": "Blocks",
          "items": {
            "type": "object",
            "additionalProperties": true
          },
          "examples": [
            [
              {
                "text": "# Deploy approval\n\nApprove or reject production.",
                "type": "markdown"
              },
              {
                "type": "actions",
                "elements": [
                  {
                    "text": {
                      "text": "Approve",
                      "type": "plain_text"
                    },
                    "type": "button",
                    "value": "approve_prod",
                    "action_id": "approve_prod"
                  }
                ]
              }
            ]
          ]
        },
        "channel": {
          "type": "string",
          "description": "ID or name of the channel, private group, or IM channel to send the message to. Can be specified as either 'channel' or 'channel_id'. Do NOT include the '#' prefix (e.g., use 'general' not '#general') - any leading '#' will be automatically stripped. For DMs, use the channel ID returned by SLACK_OPEN_DM (starts with 'D'); usernames, emails, and user IDs are not valid DM targets. IMPORTANT: org-wide (Enterprise Grid) tokens cannot resolve channel names — Slack returns `team_not_found`. Pass the channel ID (e.g., 'C0ABC12345') instead; use SLACK_LIST_ALL_CHANNELS to find IDs.",
          "title": "Channel",
          "examples": [
            "C1234567890",
            "general"
          ]
        },
        "thread_ts": {
          "type": "string",
          "description": "Timestamp (`ts`) of an existing message to make this a threaded reply. Use `ts` of the parent message, not another reply. Example: '1476746824.000004'.",
          "title": "Thread Ts",
          "examples": [
            "1618033790.001500"
          ]
        },
        "unfurl_links": {
          "type": "boolean",
          "description": "Enable unfurling of text-based URLs. Defaults `false` for bots, `true` if `as_user` is `true`.",
          "title": "Unfurl Links"
        },
        "unfurl_media": {
          "type": "boolean",
          "description": "Enable media previews (images, videos) from URLs. Set to `true` (default) to show media previews, `false` to hide them.",
          "title": "Unfurl Media"
        },
        "fallback_text": {
          "type": "string",
          "description": "Optional only when using `blocks`. Maps to Slack's top-level `text` field for notifications, accessibility, search previews, and clients that cannot render blocks. This should be a short plain-text summary of the block content, not another visible message body. Omit it if you want Slack to infer fallback text from supported blocks.",
          "title": "Fallback Text",
          "examples": [
            "Deploy approval requested for production."
          ]
        },
        "markdown_text": {
          "type": "string",
          "description": "Use this for normal LLM-written message content. Pass standard Markdown exactly as written; this tool sends it to Slack's native `markdown_text` argument without converting it to blocks. Do not use this together with `blocks`. Supports Slack's native markdown handling for headings, bold, italic, links, lists, code, quotes, dividers, tables, and task lists. Slack collapses literal empty Markdown lines; to force visible blank spacer rows, put a non-breaking space on each spacer line, e.g. `a\\n\\u00a0\\n\\u00a0\\n\\u00a0\\nb`. For Slack mentions, use explicit entity syntax such as <@USER_ID>, <#CHANNEL_ID>, or <!subteam^GROUP_ID>; do not rely on @name or #name auto-linking. Use `blocks` instead when you need buttons, selects, checkboxes, image blocks, context rows, fields, accessories, or other interactive/layout controls.",
          "title": "Markdown Text",
          "examples": [
            "# Status Update\n\nSystem is **running smoothly** with *excellent* performance.\n\n```bash\nkubectl get pods\n```\n\n> All services operational ✅",
            "| Metric | Status |\n|---|---|\n| p95 latency | improved |\n| error rate | stable |",
            "a\n \n \n \nb"
          ]
        },
        "reply_broadcast": {
          "type": "boolean",
          "description": "If `true` for a threaded reply, also posts to main channel. Defaults to `false`.",
          "title": "Reply Broadcast"
        }
      },
      "required": [
        "channel"
      ],
      "title": "SendMessageRequest",
      "description": "Request schema for `SendMessage`",
      "additionalProperties": false
    }
  }
];
