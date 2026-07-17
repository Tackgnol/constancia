Feature: Campaign game dates in the GM journal

  Background:
    Given a game master administers the VTM V5 campaign "Midnight Chronicle"

  Scenario: A new journal entry keeps the current game date
    Given the campaign game date has not been set
    When the game master sets the game date to "17 July 2026" from the top bar
    And the event "The Prince Arrives" adds the journal entry "The court falls silent"
    Then the top bar shows the game date "17 July 2026"
    And the journal entry "The court falls silent" is tagged "17 July 2026"

  Scenario: A game master corrects a journal date without moving the campaign date
    Given the campaign game date is "18 July 2026"
    And a journal entry "The court falls silent" was tagged "18 July 2026"
    When the game master changes that journal entry date to "17 July 2026"
    Then the journal entry "The court falls silent" is tagged "17 July 2026"
    And the top bar still shows the game date "18 July 2026"
