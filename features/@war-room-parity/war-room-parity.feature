Feature: Consistent live and demo War Room controls

  Background:
    Given a game master administers the campaign "Midnight Chronicle"
    And the campaign is connected to the Discord channel "elysium"

  Scenario: A game master corrects and broadcasts a quick narration
    Given the live Play View is open
    When the game master tries to broadcast the incomplete narration "Wait"
    Then the quick bar explains how to complete the narration
    And the quick bar keeps "Wait" for correction
    When the game master broadcasts "The Prince enters the chamber."
    Then Discord receives the channel narration once
    And the quick bar confirms the broadcast and clears the narration

  Scenario: A failed quick narration remains ready to retry
    Given the live Play View is open
    And Discord delivery is temporarily unavailable
    When the game master broadcasts "The gallery doors slam shut."
    Then the quick bar explains that the broadcast failed
    And the quick bar keeps "The gallery doors slam shut." for retry
    When Discord delivery becomes available
    And the game master retries the quick narration
    Then Discord receives the channel narration once
    And the quick bar confirms the broadcast and clears the narration

  Scenario: A failed campaign rename remains editable
    Given the game master is editing the campaign name as "Midnight Reckoning"
    And campaign updates are temporarily unavailable
    When the game master saves the campaign name
    Then the top bar explains that the campaign name was not updated
    And "Midnight Reckoning" remains available for correction

  Scenario: Shared War Room controls keep the same mental model
    Given the demo and live War Rooms contain equivalent campaign data
    When the game master compares their navigation and player rails
    Then shared modes appear in the same order with the same names
    And equivalent players expose the same clan identity cues
