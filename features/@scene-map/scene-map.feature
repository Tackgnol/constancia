Feature: Scene and map workspace behavior contract

  Background:
    Given a game master administers the campaign "Ashen Reach"

  Scenario: Map and Play fire an event through the same execution path
    Then Map and Play use the same event fire translation

  Scenario: NPC and lore pegs deep link into their own workspaces
    Then an NPC peg links to "/npcs?npc=npc-1" live and "/demo/npcs?npc=npc-1" in demo
    And a lore peg links to "/lore?lore=lore-1" live and "/demo/lore?lore=lore-1" in demo

  Scenario: Live and demo navigation expose Map in the same position
    Then Map appears in the same position immediately after Play in both

  Scenario: A click is normalized against the rendered image, whatever the camera
    Given the map image is rendered at 300 by 200 starting at 40, 60
    When the game master clicks the map at 190, 160
    Then the placement point is (0.5, 0.5)

  Scenario: The same map point survives a zoomed and panned camera
    Given the map image is rendered at 1200 by 800 starting at -400, -240
    When the game master clicks the map at 200, 160
    Then the placement point is (0.5, 0.5)

  Scenario: A click outside the image is clamped onto it
    Given the map image is rendered at 300 by 200 starting at 40, 60
    When the game master clicks the map at 1000, 10
    Then the placement point is (1, 0)

  Scenario: Keyboard nudges move a peg by a fixed share and stop at the edge
    Given a peg sits at (0.5, 0.5)
    When the game master presses "ArrowRight" 3 times
    Then the peg sits at (0.53, 0.5)
    When the game master presses "ArrowUp" with shift 12 times
    Then the peg sits at (0.53, 0)

  Scenario: A requested scene is selected only when the campaign returned it
    Given the campaign has the scenes "Rooftop Garden, Cellar"
    When the map workspace opens with the scene query "scene-2"
    Then the workspace selects the scene named "Cellar"

  Scenario: A scene query from another campaign falls back to the first scene
    Given the campaign has the scenes "Rooftop Garden, Cellar"
    When the map workspace opens with the scene query "scene-from-another-campaign"
    Then the workspace selects the scene named "Rooftop Garden"

  Scenario: Deleting the selected scene selects the next remaining scene
    Given the campaign has the scenes "Rooftop Garden, Cellar, Undercroft"
    When the game master removes the scene named "Cellar" from the index
    Then the workspace selects the scene named "Undercroft"

  Scenario: Deleting the last scene leaves nothing selected
    Given the campaign has the scenes "Rooftop Garden"
    When the game master removes the scene named "Rooftop Garden" from the index
    Then the workspace selects no scene
