import XCTest

class CoreTestRunnerXCUITest: XCTestCase {

    override class var runsForEachTargetApplicationUIConfiguration: Bool {
        true
    }

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testLaunch() throws {
        let app = XCUIApplication()
        app.launch()

        let finishedText = app.staticTexts["Tests finished."]
        let noTestsFailed = app.staticTexts["0 tests failed."]
        XCTAssert(finishedText.waitForExistence(timeout: 60 * 10)) // 10 minutes
        XCTAssert(noTestsFailed.exists)

        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "Tests Finished Screen"
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
