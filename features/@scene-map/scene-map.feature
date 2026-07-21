Feature: Scene and map workspace behavior contract

  Background:
    Given a game master administers the campaign "Ashen Reach"

  Scenario: A game master creates a scene and attaches a map
    When the game master creates the scene "Rooftop Garden"
    And the game master attaches the map "garden-map.png" to "Rooftop Garden"
    Then the scene "Rooftop Garden" has the map "garden-map.png" attached

  Scenario: An event peg keeps its normalized position after a move and a reload
    Given the scene "Rooftop Garden" has the map "garden-map.png"
    And the event "The Prince Arrives" is ready to place
    When the game master places "The Prince Arrives" on "Rooftop Garden" at (0.5, 0.5)
    And the game master moves "The Prince Arrives" on "Rooftop Garden" to (1.4, -0.2)
    And the map reloads
    Then "The Prince Arrives" is positioned at (1, 0) on "Rooftop Garden"

  Scenario: An NPC target cannot be placed twice in the same scene but can be placed in another
    Given the scene "Rooftop Garden" has the map "garden-map.png"
    And the scene "Cellar" has the map "cellar-map.png"
    And the NPC "Magistrate Voss" is ready to place
    When the game master places "Magistrate Voss" on "Rooftop Garden" at (0.2, 0.3)
    And the game master tries to place "Magistrate Voss" on "Rooftop Garden" again at (0.6, 0.6)
    Then the placement is rejected as a duplicate target
    When the game master places "Magistrate Voss" on "Cellar" at (0.4, 0.4)
    Then "Magistrate Voss" is positioned at (0.4, 0.4) on "Cellar"

  Scenario: A target from another campaign is rejected as not found
    Given the scene "Rooftop Garden" has the map "garden-map.png"
    And the lore entry "The Sunken Bell" belongs to another campaign
    When the game master tries to place "The Sunken Bell" on "Rooftop Garden" at (0.5, 0.5)
    Then the placement is rejected as not found

  Scenario: Replacing a scene's map preserves existing peg positions
    Given the scene "Rooftop Garden" has the map "garden-map.png"
    And the NPC "Magistrate Voss" is ready to place
    And the game master places "Magistrate Voss" on "Rooftop Garden" at (0.25, 0.75)
    When the game master replaces the map on "Rooftop Garden" with "garden-map-v2.png"
    Then the scene "Rooftop Garden" has the map "garden-map-v2.png" attached
    And "Magistrate Voss" is positioned at (0.25, 0.75) on "Rooftop Garden"

  Scenario: Deleting a target removes its pegs without deleting the scene
    Given the scene "Rooftop Garden" has the map "garden-map.png"
    And the NPC "Magistrate Voss" is ready to place
    And the game master places "Magistrate Voss" on "Rooftop Garden" at (0.25, 0.75)
    When the game master deletes the NPC "Magistrate Voss"
    Then "Rooftop Garden" has no peg for "Magistrate Voss"
    And the scene "Rooftop Garden" still exists

  Scenario: Deleting a scene removes its pegs without deleting its targets
    Given the scene "Rooftop Garden" has the map "garden-map.png"
    And the NPC "Magistrate Voss" is ready to place
    And the game master places "Magistrate Voss" on "Rooftop Garden" at (0.25, 0.75)
    When the game master deletes the scene "Rooftop Garden"
    Then the scene "Rooftop Garden" no longer exists
    And the NPC "Magistrate Voss" still exists

  Scenario: An event peg is armed, confirmed, and produces one idempotent execution receipt
    Given the scene "Rooftop Garden" has the map "garden-map.png"
    And the event "The Prince Arrives" is ready to place
    And the game master places "The Prince Arrives" on "Rooftop Garden" at (0.5, 0.5)
    When the game master arms "The Prince Arrives" on "Rooftop Garden"
    And the game master confirms the armed event
    Then "The Prince Arrives" has one execution receipt
    When the confirmation is retried after an ambiguous response
    Then "The Prince Arrives" still has one execution receipt

  Scenario: Cancelling an armed event never executes it
    Given the scene "Rooftop Garden" has the map "garden-map.png"
    And the event "The Prince Arrives" is ready to place
    And the game master places "The Prince Arrives" on "Rooftop Garden" at (0.5, 0.5)
    When the game master arms "The Prince Arrives" on "Rooftop Garden"
    And the game master cancels the armed event
    Then "The Prince Arrives" has no execution receipt

  Scenario: Re-arming after a fired event starts a new execution
    Given the scene "Rooftop Garden" has the map "garden-map.png"
    And the event "The Prince Arrives" is ready to place
    And the game master places "The Prince Arrives" on "Rooftop Garden" at (0.5, 0.5)
    When the game master arms "The Prince Arrives" on "Rooftop Garden"
    And the game master confirms the armed event
    And the game master arms "The Prince Arrives" on "Rooftop Garden" again
    And the game master confirms the armed event
    Then "The Prince Arrives" has 2 execution receipts

  Scenario: Map and Play fire an event through the same execution path
    Then Map and Play use the same event fire translation

  Scenario: NPC and lore pegs deep link into their own workspaces
    Then an NPC peg links to "/npcs?npc=npc-1" live and "/demo/npcs?npc=npc-1" in demo
    And a lore peg links to "/lore?lore=lore-1" live and "/demo/lore?lore=lore-1" in demo

  Scenario: Live and demo navigation expose Map in the same position
    When the game master compares live and demo navigation
    Then Map appears in the same position immediately after Play in both

  Scenario: The existing Play channel filter remains available under its new label
    Then the Play channel filter is still available
    And the filter is presented using channel terminology rather than scene terminology

  Scenario: Attaching a map is one action that leaves no orphaned upload
    Given the scene "Rooftop Garden" exists without a map
    When the game master submits the map "garden-map.png" for "Rooftop Garden"
    Then the scene "Rooftop Garden" has the map "garden-map.png" attached
    And no uploaded asset is left unattached

  Scenario: A failed attachment deletes the upload it already made
    Given the scene "Rooftop Garden" exists without a map
    And attaching a map will fail
    When the game master submits the map "garden-map.png" for "Rooftop Garden"
    Then the game master is told the attachment failed
    And no uploaded asset is left unattached
    And the scene "Rooftop Garden" has no map

  Scenario: A failed compensation still reports the attachment failure and records the orphan
    Given the scene "Rooftop Garden" exists without a map
    And attaching a map will fail
    And deleting an unattached upload will fail
    When the game master submits the map "garden-map.png" for "Rooftop Garden"
    Then the game master is told the attachment failed
    And the orphaned upload is recorded for reconciliation

  Scenario: Submitting no file never reaches the backend
    Given the scene "Rooftop Garden" exists without a map
    When the game master submits the map form for "Rooftop Garden" without choosing a file
    Then no upload is attempted
    And the scene "Rooftop Garden" has no map

  Scenario: Removing a map keeps the scene and its peg positions
    Given the scene "Rooftop Garden" has the map "garden-map.png"
    And the NPC "Magistrate Voss" is ready to place
    And the game master places "Magistrate Voss" on "Rooftop Garden" at (0.25, 0.75)
    When the game master removes the map from "Rooftop Garden"
    Then the scene "Rooftop Garden" has no map
    And "Magistrate Voss" is positioned at (0.25, 0.75) on "Rooftop Garden"

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
