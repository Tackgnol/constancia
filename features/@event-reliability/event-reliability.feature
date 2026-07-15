Feature: Reliable event execution between Play View and Discord

  Background:
    Given a game master administers the campaign "Midnight Chronicle"
    And the campaign is connected to the Discord channel "elysium"

  Scenario: A live cue is executed and delivered exactly once
    Given the narration cue "The Prince Arrives" is ready in Play View
    When the game master fires "The Prince Arrives"
    And Play View repeats the same fire request
    Then Play View shows "The Prince Arrives" as delivered
    And Discord receives the narration once
    And the cue pipeline has one execution receipt

  Scenario: Discord delivery recovers without rerunning the cue
    Given the Discord bot is temporarily unavailable
    And the narration cue "A Door Slams" is ready in Play View
    When the game master fires "A Door Slams"
    Then Play View shows "A Door Slams" as awaiting delivery
    And the cue pipeline has one execution receipt
    When the Discord bot becomes available
    Then Discord eventually receives the narration once
    And Play View shows "A Door Slams" as delivered
    And the cue pipeline still has one execution receipt

  Scenario: A player's Discord test result completes the matching cue once
    Given the test cue "Read the Sheriff" has been delivered to the player
    When the player submits a score of 4 from Discord
    And Discord repeats the same test-result request
    Then the player receives the resolved outcome once
    And Play View shows the result for "Read the Sheriff"
    And the test cue has one result receipt for that player

  Scenario: A campaign cannot execute another campaign's cue
    Given the cue "Foreign Orders" belongs to another campaign
    When the game master tries to fire "Foreign Orders" from "Midnight Chronicle"
    Then Play View reports that the cue is unavailable
    And the foreign cue pipeline is not executed
    And Discord receives no message for "Foreign Orders"
