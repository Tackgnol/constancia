Feature: Operator moderation of reported bot messages

  Background:
    Given a game master administers the VTM V5 campaign "Midnight Chronicle"
    And the operator is signed in as a superuser

  Scenario: A reported message leads to a campaign suspension that silences the bot
    Given the event "The Prince Arrives" was delivered to the main channel
    And a player reported that message
    When the operator opens the admin reports page
    Then the report shows the campaign "Midnight Chronicle"
    When the operator suspends the campaign with the public reason "Suspended pending review."
    Then queued deliveries for "Midnight Chronicle" are cancelled
    And the game master is told "Suspended pending review." when they use Constancia

  Scenario: A banned game master hears their own reason, not the campaign's
    Given the campaign is suspended with the public reason "Suspended pending review."
    And the game master is banned with the reason shown to them "Repeated harassment."
    When the game master uses Constancia
    Then they are told "Repeated harassment."

  Scenario: Re-enabling a campaign does not resend cancelled messages
    Given the campaign was suspended and its deliveries were cancelled
    When the operator re-enables the campaign
    Then those deliveries stay cancelled
    And no message is sent to the main channel
