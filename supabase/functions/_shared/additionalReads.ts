// Read-only tools reviewed against live Composio schemas on 2026-11-02.
export const additionalReads = [
  {name:'GOOGLE_MAPS_GET_ROUTE',toolkit:'google_maps',description:'Calculate actual routes between supplied origins and destinations.',requiresConfirmation:false},
  {name:'GOOGLE_MAPS_TEXT_SEARCH',toolkit:'google_maps',description:'Find actual places matching the supplied search.',requiresConfirmation:false},
  {name:'GOOGLE_MAPS_NEARBY_SEARCH',toolkit:'google_maps',description:'Find places near a user-supplied or explicitly shared location.',requiresConfirmation:false},
  {
    "name": "GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID",
    "toolkit": "gmail",
    "description": "Fetches a Gmail message by its message ID in the requested format and returns formatted message details. Available fields depend on the format.",
    "requiresConfirmation": false,
    "parameters": {
      "type": "object",
      "required": [
        "message_id"
      ],
      "properties": {
        "format": {
          "type": "string",
          "default": "full",
          "examples": [
            "metadata",
            "minimal",
            "full",
            "raw"
          ],
          "description": "Format for message content. 'minimal': lightest (ID, thread ID, labels only). 'metadata': headers and message metadata without body content - ideal for summarization, analysis, or when you only need subject/sender/timestamp (recommended for most use cases). 'full': complete MIME structure with 50+ headers, nested parts, and base64url-encoded body data - heavy payload, only use when you need the complete raw MIME structure for parsing attachments or body content. 'raw': entire RFC 2822 formatted message as base64url string."
        },
        "user_id": {
          "type": "string",
          "default": "me",
          "examples": [
            "user@example.com",
            "me"
          ],
          "description": "User's email address or 'me' for the authenticated user."
        },
        "message_id": {
          "type": "string",
          "examples": [
            "19b11732c1b578fd",
            "18c5e5b5f5d5e5b5",
            "1736ccf5d7b4d452"
          ],
          "minLength": 1,
          "description": "The Gmail API message ID (hexadecimal string, typically 15-16 characters like '19b11732c1b578fd'). Must be obtained from Gmail API responses (e.g., List Messages, Search Messages). Do NOT use email subjects, dates, sender names, or custom identifiers. Do NOT use `threadId` (use GMAIL_FETCH_MESSAGE_BY_THREAD_ID for threads), the Message-ID email header, or any fabricated value — only IDs from Gmail API list/search responses."
        }
      }
    }
  },
  {
    "name": "SLACK_SEARCH_MESSAGES",
    "toolkit": "slack",
    "description": "Workspace‑wide Slack message search with date ranges and filters. Use `query` modifiers (e.g., in:#channel, from:@user, before/after:YYYY-MM-DD), sorting (score/timestamp), and pagination.",
    "requiresConfirmation": false,
    "parameters": {
      "type": "object",
      "required": [
        "query"
      ],
      "properties": {
        "page": {
          "type": "integer",
          "examples": [
            1,
            2,
            3
          ],
          "description": "Page number for manual pagination control. Cannot be used with auto_paginate - choose either automatic collection OR manual page control, not both."
        },
        "sort": {
          "type": "string",
          "examples": [
            "score",
            "timestamp"
          ],
          "description": "Sort results by `score` (relevance) or `timestamp` (chronological)."
        },
        "count": {
          "type": "integer",
          "default": 1,
          "examples": [
            20,
            50,
            100,
            500,
            1000
          ],
          "description": "Without auto_paginate: Number of messages per page (max 100). With auto_paginate: Total messages desired. Set count=500 to get 500 messages with automatic pagination handling."
        },
        "query": {
          "type": "string",
          "examples": [
            "on:2025-09-25",
            "after:2025-01-01 before:2025-12-31",
            "during:september",
            "during:2025-09-25",
            "product launch in:#marketing",
            "bug report from:@jane has:file",
            "\"meeting notes\" on:2024-07-20",
            "urgent -resolved in:#support",
            "\"project update\" on:2025-09-25 from:@john in:#team-updates",
            "has:link during:august from:@bot",
            "deployment after:2025-09-20 in:#engineering"
          ],
          "description": "Search query supporting various modifiers for precise filtering:\n\n        **Location Modifiers:**\n        - `in:#channel-name` - Messages in specific channel\n        - `in:@username` - Direct messages with user\n\n        **User Modifiers:**\n        - `from:@username` - Messages from specific user\n        - `from:botname` - Messages from bot\n\n        **Content Modifiers:**\n        - `has:link` - Messages with links\n        - `has:file` - Messages with files\n        - `has::star:` - Starred messages\n        - `has::pin:` - Pinned messages\n\n        **Special Characters:**\n        - `\"exact phrase\"` - Search exact phrase\n        - `*wildcard` - Wildcard matching\n        - `-exclude` - Exclude words\n\n        **Combinations:** Mix modifiers with date filters like `\"project update\" on:2025-09-25 in:#marketing from:@john`"
        },
        "cursor": {
          "type": "string",
          "examples": [
            "*",
            "dXNlcjpVMEc5V0ZYTlo="
          ],
          "description": "Cursor for cursor-mark pagination. Use `*` for the first call, then use `next_cursor` from the previous response for subsequent calls. This is the modern pagination approach recommended by Slack. Cannot be used with `page` parameter - choose either cursor-based or page-based pagination."
        },
        "team_id": {
          "type": "string",
          "examples": [
            "T1234567890"
          ],
          "description": "ID of the Slack workspace (team) to operate on, e.g. T0123456789. Use only with org-level Enterprise Grid tokens when you need to target a specific workspace; omit for single-workspace tokens."
        },
        "sort_dir": {
          "type": "string",
          "examples": [
            "asc",
            "desc"
          ],
          "description": "Sort direction: `asc` (ascending) or `desc` (descending)."
        },
        "highlight": {
          "type": "boolean",
          "examples": [
            true,
            false
          ],
          "description": "Enable highlighting of search terms in results."
        },
        "auto_paginate": {
          "type": "boolean",
          "default": false,
          "examples": [
            true,
            false
          ],
          "description": "When enabled, 'count' becomes the total messages desired instead of per-page limit. System automatically handles pagination to collect the specified total. Cannot be used with 'page' parameter - choose either automatic collection or manual page control. Usage: If you fetched 100 messages but pagination shows 500 total available, set auto_paginate=true and count=500 to get all results at once."
        }
      }
    }
  },
  {
    "name": "GOOGLECALENDAR_EVENTS_LIST_ALL_CALENDARS",
    "toolkit": "googlecalendar",
    "description": "Lists and deduplicates events across selected calendars or the user's calendar list for a time range. Returns a compact summary by default, with full event details available on request; per-calendar errors can make results incomplete.",
    "requiresConfirmation": false,
    "parameters": {
      "type": "object",
      "required": [
        "time_min",
        "time_max"
      ],
      "properties": {
        "q": {
          "type": "string",
          "description": "Free text search terms to find events that match these terms in any field, except for extended properties. Optional."
        },
        "time_max": {
          "type": "string",
          "description": "Upper bound (exclusive) for an event's start time to filter by. Must be an RFC3339 timestamp with mandatory time zone offset (e.g., 2011-06-03T10:00:00-07:00 or 2011-06-03T10:00:00Z). If timezone offset is missing, UTC (Z) will be automatically appended. Required."
        },
        "time_min": {
          "type": "string",
          "description": "Lower bound (inclusive) for an event's end time to filter by. Must be an RFC3339 timestamp with mandatory time zone offset (e.g., 2011-06-03T10:00:00-07:00 or 2011-06-03T10:00:00Z). If timezone offset is missing, UTC (Z) will be automatically appended. Required."
        },
        "event_types": {
          "type": "array",
          "items": {
            "enum": [
              "birthday",
              "default",
              "focusTime",
              "fromGmail",
              "outOfOffice",
              "workingLocation"
            ],
            "type": "string",
            "description": "Valid event types for Google Calendar API."
          },
          "description": "Event types to return. Optional."
        },
        "calendar_ids": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Optional list of specific calendar IDs to query. If not provided, all calendars from the user's calendar list will be queried."
        },
        "show_deleted": {
          "type": "boolean",
          "default": false,
          "description": "Whether to include deleted events (with status equals 'cancelled') in the result. Optional. The default is False."
        },
        "single_events": {
          "type": "boolean",
          "default": true,
          "description": "Whether to expand recurring events into instances and only return single one-off events and instances of recurring events. Optional. The default is True."
        },
        "response_detail": {
          "enum": [
            "minimal",
            "full"
          ],
          "type": "string",
          "default": "minimal",
          "description": "Level of detail in the response. 'minimal' (default) returns only the compact summary_view, omitting the large events array to reduce token usage. 'full' returns both summary_view and the full detailed events array."
        },
        "max_results_per_calendar": {
          "type": "integer",
          "description": "Maximum number of events returned per calendar. Optional. If not provided, defaults to the API's default (250). Results may be paginated; follow `nextPageToken` in the response until absent to retrieve the complete event list."
        }
      }
    }
  },
  {
    "name": "GOOGLECALENDAR_GET_CURRENT_DATE_TIME",
    "toolkit": "googlecalendar",
    "description": "Gets the current date and time, allowing for a specific timezone offset. Call this tool first before computing relative dates (e.g., 'tomorrow', 'next Monday') to avoid off-by-one-day errors across timezones.",
    "requiresConfirmation": false,
    "parameters": {
      "type": "object",
      "properties": {
        "timezone": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "number"
            }
          ],
          "default": 0,
          "examples": [
            "America/New_York",
            "Asia/Kolkata",
            "Europe/London",
            "Asia/Tokyo",
            "America/Los_Angeles",
            "Australia/Sydney",
            "PST",
            "EST",
            "GMT",
            0,
            5.5,
            -5,
            9
          ],
          "description": "Timezone specification. Accepts: (1) IANA timezone identifier (e.g., 'America/New_York', 'Asia/Kolkata', 'Europe/London') - RECOMMENDED, (2) Common timezone abbreviations (e.g., 'PST', 'EST', 'CST', 'GMT', 'UTC') - will be auto-converted to IANA, or (3) Numeric UTC offset in hours (e.g., -5, 5.5). Use positive values for east of UTC, negative for west. Default 0 is UTC."
        }
      }
    }
  },
  {
    "name": "TRELLO_GET_MEMBERS_CARDS_BY_ID_MEMBER",
    "toolkit": "trello",
    "description": "Retrieves cards for a Trello member, specified by ID or username, with options to filter cards and include related data like actions, attachments, and checklists.",
    "requiresConfirmation": false,
    "parameters": {
      "type": "object",
      "required": [
        "idMember"
      ],
      "properties": {
        "limit": {
          "type": "string",
          "examples": [
            "100",
            "50"
          ],
          "description": "Max cards to return (1-1000). Trello's default applies if omitted."
        },
        "since": {
          "type": "string",
          "examples": [
            "2023-01-15T00:00:00Z",
            "null"
          ],
          "description": "Return cards updated after this ISO 8601 date. 'null' or omit for no lower limit."
        },
        "before": {
          "type": "string",
          "examples": [
            "2023-12-31T23:59:59Z",
            "null"
          ],
          "description": "Return cards updated before this ISO 8601 date. 'null' or omit for no upper limit."
        },
        "fields": {
          "type": "string",
          "default": "all",
          "examples": [
            "name,due,idBoard",
            "all",
            "labels,url"
          ],
          "description": "Card fields to return. 'all' or comma-separated (e.g., `name`, `due`, `idBoard`, `labels`)."
        },
        "filter": {
          "type": "string",
          "default": "visible",
          "examples": [
            "open",
            "closed",
            "all"
          ],
          "description": "Card filter: 'all', 'closed', 'none', 'open', or 'visible'. 'visible' means cards on open boards member can see."
        },
        "actions": {
          "type": "string",
          "examples": [
            "commentCard,createCard",
            "all",
            "updateCard:idList"
          ],
          "description": "Filters actions on cards. 'all' or comma-separated Trello action types (e.g., `commentCard`, `createCard`)."
        },
        "members": {
          "type": "string",
          "examples": [
            "true",
            "false"
          ],
          "description": "Include member details on cards: 'true' or 'false'."
        },
        "idMember": {
          "type": "string",
          "examples": [
            "me",
            "60d5f2f12f8f7b007f8d9e0a",
            "john_doe"
          ],
          "description": "The ID or username of the Trello member. Use 'me' for the authenticated user."
        },
        "stickers": {
          "type": "string",
          "examples": [
            "true",
            "false"
          ],
          "description": "Include stickers: 'true' or 'false'."
        },
        "checklists": {
          "type": "string",
          "default": "none",
          "examples": [
            "all",
            "none"
          ],
          "description": "Include checklists: 'all' or 'none'."
        },
        "attachments": {
          "type": "string",
          "examples": [
            "true",
            "false",
            "cover"
          ],
          "description": "Include attachments: 'true' (all), 'false' (none), or 'cover' (card cover only)."
        },
        "member_fields": {
          "type": "string",
          "default": "avatarHash,fullName,initials,username",
          "examples": [
            "fullName,username",
            "all",
            "avatarHash,initials"
          ],
          "description": "Member fields if 'members' is true. 'all' or comma-separated (e.g., `fullName`, `username`, `initials`)."
        },
        "checkItemStates": {
          "type": "string",
          "examples": [
            "true",
            "false"
          ],
          "description": "Include check item states: 'true' or 'false'."
        },
        "attachment_fields": {
          "type": "string",
          "default": "all",
          "examples": [
            "name,url,date",
            "all"
          ],
          "description": "Attachment fields if including attachments. 'all' or comma-separated (e.g., `name`, `url`, `date`)."
        }
      }
    }
  },
  {
    "name": "TRELLO_GET_MEMBERS_ME",
    "toolkit": "trello",
    "description": "Tool to retrieve information about the currently authenticated Trello member. Use when you need profile details, settings, or member metadata.",
    "requiresConfirmation": false,
    "parameters": {
      "type": "object",
      "properties": {
        "cards": {
          "type": "string",
          "examples": [
            "all",
            "open",
            "visible"
          ],
          "description": "Optional parameter to include cards. Accepts 'all', 'none', or card filter values like 'open', 'closed', 'visible'."
        },
        "boards": {
          "type": "string",
          "examples": [
            "all",
            "open",
            "starred"
          ],
          "description": "Optional parameter to include boards. Accepts 'all' or a comma-separated list of board filters."
        },
        "fields": {
          "type": "string",
          "examples": [
            "all",
            "fullName,username,email",
            "id,bio,avatarUrl"
          ],
          "description": "Comma-separated list of member fields to return. Use 'all' for all fields. Valid field names: id, activityBlocked, avatarHash, avatarUrl, avatarSource, bio, bioData, confirmed, fullName, idEnterprise, idEnterprisesDeactivated, idMemberReferrer, idPremOrgsAdmin, initials, memberType, nonPublic, nonPublicAvailable, products, url, username, status, aaId, aaEmail, email, gravatarHash, idBoards, idBoardsPinned, idOrganizations, loginTypes, oneTimeMessagesDismissed, prefs, premiumFeatures, trophies, uploadedAvatarHash."
        },
        "actions": {
          "type": "string",
          "examples": [
            "all",
            "commentCard,createCard"
          ],
          "description": "Optional parameter to include actions. Accepts 'all' or a comma-separated list of action types."
        },
        "boardStars": {
          "type": "string",
          "examples": [
            "all",
            "none"
          ],
          "description": "Optional parameter to include board stars. Valid values: 'all' or 'none'."
        },
        "customEmoji": {
          "type": "string",
          "examples": [
            "all",
            "none"
          ],
          "description": "Optional parameter to include custom emoji. Valid values: 'all' or 'none'."
        },
        "boardsInvited": {
          "type": "string",
          "examples": [
            "all",
            "none"
          ],
          "description": "Optional parameter to include boards the member is invited to. Valid values: 'all' or 'none'."
        },
        "customStickers": {
          "type": "string",
          "examples": [
            "all",
            "none"
          ],
          "description": "Optional parameter to include custom stickers. Valid values: 'all' or 'none'."
        },
        "boardBackgrounds": {
          "type": "string",
          "examples": [
            "all",
            "none",
            "default"
          ],
          "description": "Optional parameter to include board backgrounds. Valid values: 'all', 'none', or 'default'."
        },
        "customBoardBackgrounds": {
          "type": "string",
          "examples": [
            "all",
            "none"
          ],
          "description": "Optional parameter to include custom board backgrounds. Valid values: 'all' or 'none'."
        }
      }
    }
  },
  {
    "name": "NOTION_GET_PAGE_MARKDOWN",
    "toolkit": "notion",
    "description": "Retrieve a Notion page as Notion-flavored Markdown in a single API call without recursive block-children fetching. The response indicates whether content was truncated and identifies blocks that could not be rendered.",
    "requiresConfirmation": false,
    "parameters": {
      "type": "object",
      "properties": {
        "page_id": {
          "type": "string",
          "description": "The UUID of the Notion page to retrieve as markdown. Accepts both hyphenated (8-4-4-4-12) and unhyphenated (32 characters) UUID formats. This endpoint retrieves the full page content rendered as Notion-flavored Markdown in a single API call, avoiding the need for recursive block-children fetching. IMPORTANT: Only page IDs are accepted - database IDs will be rejected. To retrieve database content, use the 'Fetch Database' or 'Query Database' actions instead.",
          "title": "Page Id",
          "examples": [
            "6c6a9b6c-12a4-4c3e-98e2-3c7a1e4f2d2a",
            "6c6a9b6c12a44c3e98e23c7a1e4f2d2a"
          ]
        },
        "include_transcript": {
          "type": "boolean",
          "description": "Set to true to include meeting note transcripts in the markdown response. Defaults to false if not specified.",
          "title": "Include Transcript"
        }
      },
      "required": [
        "page_id"
      ],
      "title": "GetPageMarkdownRequest"
    }
  },
  {
    "name": "NOTION_FETCH_BLOCK_CONTENTS",
    "toolkit": "notion",
    "description": "Retrieves a paginated list of direct child blocks for a Notion block or page. Use returned block IDs to access nested content; for an unsupported block-type error, the result is an empty list with an explanatory message.",
    "requiresConfirmation": false,
    "parameters": {
      "type": "object",
      "properties": {
        "block_id": {
          "type": "string",
          "description": "UUID of the parent Notion block or page whose children are to be fetched. Accepts both hyphenated (e.g., 'c02fc1d3-db8b-45c5-a222-27595b15aea7') and non-hyphenated (e.g., 'c02fc1d3db8b45c5a22227595b15aea7') UUID formats. Notion's API does not support special identifiers like 'root' or 'top-level' - you must always provide an actual page or block UUID. To discover valid page/block IDs, first use 'NOTION_SEARCH_NOTION_PAGE' to find pages or 'NOTION_QUERY_DATABASE' to query databases.",
          "title": "Block Id",
          "examples": [
            "c02fc1d3-db8b-45c5-a222-27595b15aea7"
          ]
        },
        "page_size": {
          "type": "integer",
          "description": "The maximum number of child blocks to return in a single response. The actual number of results may be lower if there are fewer child blocks available or if the end of the list is reached. Maximum allowed value is 100. If unspecified, Notion's default page size will be used.",
          "title": "Page Size",
          "examples": [
            "25",
            "50",
            "100"
          ]
        },
        "start_cursor": {
          "type": "string",
          "description": "Pagination cursor from next_cursor in a previous API response. When paginating through results, pass the next_cursor value from the previous response here to fetch the next page. Must be a valid UUID format or cursor string returned by Notion's API. If omitted, returns the first page of results.",
          "title": "Start Cursor",
          "examples": [
            "a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6"
          ]
        }
      },
      "required": [
        "block_id"
      ],
      "title": "FetchBlockContentsRequest"
    }
  },
  {
    "name": "SLACK_FETCH_CONVERSATION_HISTORY",
    "toolkit": "slack",
    "description": "Fetches a chronological list of messages and events from a specified Slack conversation, accessible by the authenticated user/bot, with options for pagination and time range filtering. IMPORTANT LIMITATION: This action only returns messages from the main channel timeline. Threaded replies are NOT returned by this endpoint. To retrieve threaded replies, use the SLACK_FETCH_MESSAGE_THREAD_FROM_A_CONVERSATION action (conversations.replies API) instead. The oldest/latest timestamp filters work reliably for filtering the main channel timeline, but cannot be used to retrieve individual threaded replies - even if you know the exact reply timestamp, setting oldest=latest to that timestamp will return an empty messages array. To get threaded replies: 1. Use this action to get parent messages (which include thread_ts, reply_count, latest_reply fields) 2. Use SLACK_FETCH_MESSAGE_THREAD_FROM_A_CONVERSATION with the parent's thread_ts to fetch all replies in that thread",
    "requiresConfirmation": false,
    "parameters": {
      "type": "object",
      "properties": {
        "limit": {
          "type": "integer",
          "description": "Maximum number of messages to request in this single Slack API call (1-1000). Defaults to 100. Slack may return fewer than requested, especially for non-Marketplace apps where Slack can cap each page at 15 messages. This action does not internally paginate; use response_metadata.next_cursor in the cursor parameter of a follow-up call to fetch more messages.",
          "title": "Limit",
          "default": 100,
          "minimum": 1,
          "maximum": 1000,
          "examples": [
            "100",
            "200"
          ]
        },
        "cursor": {
          "type": "string",
          "description": "Pagination cursor from `response_metadata.next_cursor` of a previous response. Omit this for the first page; pass the returned cursor in a follow-up call to fetch the next page.",
          "title": "Cursor",
          "examples": [
            "dXNlcjpVMDYxTkZUVDA="
          ]
        },
        "latest": {
          "type": "string",
          "description": "End of the time range of messages to include in results. Accepts a Unix timestamp or a Slack timestamp (e.g., '1234567890.000000'). NOTE: This filter only applies to main channel messages, not threaded replies. Use SLACK_FETCH_MESSAGE_THREAD_FROM_A_CONVERSATION to retrieve replies.",
          "title": "Latest",
          "examples": [
            "1609459200.000000"
          ]
        },
        "oldest": {
          "type": "string",
          "description": "Start of the time range of messages to include in results. Accepts a Unix timestamp or a Slack timestamp (e.g., '1234567890.000000'). NOTE: This filter only applies to main channel messages, not threaded replies. Use SLACK_FETCH_MESSAGE_THREAD_FROM_A_CONVERSATION to retrieve replies.",
          "title": "Oldest",
          "examples": [
            "1609372800.000000"
          ]
        },
        "channel": {
          "type": "string",
          "description": "The ID of the public channel, private channel, direct message, or multi-person direct message to fetch history from.",
          "title": "Channel",
          "examples": [
            "C1234567890",
            "G0123456789",
            "D0123456789"
          ]
        },
        "inclusive": {
          "type": "boolean",
          "description": "When true, includes messages at the exact 'oldest' or 'latest' boundary timestamps in results. When false (default), excludes boundary messages. Only applies when 'oldest' or 'latest' is specified.",
          "title": "Inclusive",
          "examples": [
            true,
            false
          ]
        },
        "include_all_metadata": {
          "type": "boolean",
          "description": "Return all metadata associated with messages in the conversation history. When true, includes additional metadata fields that may be present on messages.",
          "title": "Include All Metadata",
          "examples": [
            true
          ]
        }
      },
      "required": [
        "channel"
      ],
      "title": "FetchConversationHistoryRequest",
      "description": "Request schema for fetching conversation history from Slack."
    }
  },
  {
    "name": "SLACK_FETCH_MESSAGE_THREAD_FROM_A_CONVERSATION",
    "toolkit": "slack",
    "description": "Retrieves replies to a specific parent message in a Slack conversation, using the channel ID and the parent message's timestamp (`ts`). Note: The parent message in the response contains metadata (reply_count, reply_users, latest_reply) that indicates expected thread activity. If the returned messages array contains fewer replies than reply_count indicates, check: (1) has_more=true means pagination is needed, (2) recently posted replies may have timing delays, (3) some replies may be filtered by permissions or deleted. The composio_execution_message field will warn about any detected mismatches.",
    "requiresConfirmation": false,
    "parameters": {
      "type": "object",
      "properties": {
        "ts": {
          "type": "string",
          "description": "Timestamp of the parent message in the thread. Must be an existing message. If no replies, only the parent message itself is returned. Must be the exact full timestamp string of the root/parent message — not a reply's ts, a truncated value, a permalink, or an integer; these silently return wrong results.",
          "title": "Ts",
          "examples": [
            "1234567890.123456"
          ]
        },
        "limit": {
          "type": "integer",
          "description": "Maximum number of messages to return. Fewer may be returned even if more are available.",
          "title": "Limit",
          "examples": [
            100
          ]
        },
        "cursor": {
          "type": "string",
          "description": "Pagination cursor from `response_metadata.next_cursor` of a previous response to get subsequent pages. If omitted, fetches the first page.",
          "title": "Cursor",
          "examples": [
            "dXNlcjpVMEc5V0ZYTlo="
          ]
        },
        "latest": {
          "type": "string",
          "description": "Latest message timestamp in the time range to include results.",
          "title": "Latest",
          "examples": [
            "1678886400.000000"
          ]
        },
        "oldest": {
          "type": "string",
          "description": "Oldest message timestamp in the time range to include results. Must be a UTC-based Slack ts string; incorrect timezone conversion or rounding can produce empty result windows.",
          "title": "Oldest",
          "examples": [
            "1678836000.000000"
          ]
        },
        "channel": {
          "type": "string",
          "description": "ID of the conversation (channel, direct message, etc.) to fetch the thread from. Must be a channel ID, not a channel name. Token must have membership in private channels or DMs, otherwise returns empty results or `not_in_channel`/`channel_not_found`.",
          "title": "Channel",
          "examples": [
            "C0123456789"
          ]
        },
        "inclusive": {
          "type": "boolean",
          "description": "Whether to include messages with `latest` or `oldest` timestamps in results. Effective only if `latest` or `oldest` is specified.",
          "title": "Inclusive",
          "examples": [
            true
          ]
        },
        "include_all_metadata": {
          "type": "boolean",
          "description": "Return all metadata associated with messages in the thread. When true, includes additional metadata fields that may be present on messages.",
          "title": "Include All Metadata",
          "examples": [
            true
          ]
        }
      },
      "required": [
        "channel",
        "ts"
      ],
      "title": "FetchMessageThreadFromAConversationRequest",
      "description": "Request schema for `FetchMessageThreadFromAConversation`"
    }
  },
  {
    "name": "SLACK_RETRIEVE_MESSAGE_PERMALINK_URL",
    "toolkit": "slack",
    "description": "Retrieves a permalink URL for a specific message in a Slack channel or conversation; the permalink respects Slack's privacy settings.",
    "requiresConfirmation": false,
    "parameters": {
      "type": "object",
      "properties": {
        "channel": {
          "type": "string",
          "description": "The ID of the conversation or channel containing the message. This can be a public channel ID, a private channel ID, a direct message channel ID, or a multi-person direct message channel ID. Must be a channel ID, not a channel name; use SLACK_FIND_CHANNELS to resolve names to IDs.",
          "title": "Channel",
          "examples": [
            "C012AB3CD",
            "G123456"
          ]
        },
        "message_ts": {
          "type": "string",
          "description": "A message's `ts` value (timestamp), uniquely identifying it within a channel. Example: '1610144875.000600'.",
          "title": "Message Ts",
          "examples": [
            "1610144875.000600",
            "15712345.001500"
          ]
        }
      },
      "required": [
        "channel",
        "message_ts"
      ],
      "title": "RetrieveMessagePermalinkUrlRequest",
      "description": "Request schema for `RetrieveMessagePermalinkUrl`"
    }
  }
];
