/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";
import * as TypeMoq from "typemoq";
import Rectangle, { RectangleProps } from "../../../../src/utilities/Rectangle";
import Layout from "../../../../src/zones/state/layout/Layout";
import Root from "../../../../src/zones/state/layout/Root";
import Size from "../../../../src/utilities/Size";

class LayoutMock extends Layout {
  private _topZone: LayoutMock | undefined;
  private _bottomZone: LayoutMock | undefined;
  private _leftZone: LayoutMock | undefined;
  private _rightZone: LayoutMock | undefined;
  private _minHeight: number | undefined = undefined;
  private _minWidth: number | undefined = undefined;

  public constructor(bounds: RectangleProps = new Rectangle(), root = new Root(new Size(), true)) {
    super(bounds, root);
  }

  public get topZone() {
    return this._topZone;
  }

  public set topZone(z: LayoutMock | undefined) {
    this._topZone = z;
  }

  public get bottomZone() {
    return this._bottomZone;
  }

  public set bottomZone(z: LayoutMock | undefined) {
    this._bottomZone = z;
  }

  public get leftZone() {
    return this._leftZone;
  }

  public set leftZone(z: LayoutMock | undefined) {
    this._leftZone = z;
  }

  public get rightZone() {
    return this._rightZone;
  }

  public set rightZone(z: LayoutMock | undefined) {
    this._rightZone = z;
  }

  public set bounds(bounds: Rectangle) {
    this.setBounds(bounds);
  }

  public get bounds() {
    return super.bounds;
  }

  public get minHeight() {
    if (this._minHeight)
      return this._minHeight;
    return super.minHeight;
  }

  public set minHeight(height: number) { this._minHeight = height; }

  public get minWidth() {
    if (this._minWidth)
      return this._minWidth;
    return super.minWidth;
  }

  public set minWidth(width: number) { this._minWidth = width; }
}

describe("Layout", () => {
  const root = TypeMoq.Mock.ofType<Root>();

  beforeEach(() => {
    root.reset();
  });

  describe("#get minWidth()", () => {
    it("should return 296", () => {
      const sut = new LayoutMock(new Rectangle());
      sut.minWidth.should.eq(296);
    });
  });

  describe("#get minHeight()", () => {
    it("should return 220", () => {
      const sut = new LayoutMock(new Rectangle());
      sut.minHeight.should.eq(220);
    });
  });

  describe("#tryGrowTop()", () => {
    it("should throw for negative", () => {
      const sut = new LayoutMock(new Rectangle());
      (() => { sut.tryGrowTop(-100); }).should.throw();
    });

    it("should grow in size", () => {
      const sut = new LayoutMock(new Rectangle(100, 200, 200, 400));
      sut.tryGrowTop(100);

      sut.bounds.top.should.eq(100);
      sut.bounds.bottom.should.eq(400);
    });

    it("should be contained by top zone", () => {
      const topZone = TypeMoq.Mock.ofType<Layout>();
      topZone.setup((x) => x.bounds).returns(() => new Rectangle(100, 100, 300, 150));
      topZone.setup((x) => x.tryShrinkBottom(TypeMoq.It.isAnyNumber())).returns(() => 0);
      const sut = TypeMoq.Mock.ofInstance(new Layout(new Rectangle(100, 200, 200, 400), root.object));
      sut.callBase = true;
      sut.setup((x) => x.topZone).returns(() => topZone.object);

      sut.object.tryGrowTop(100).should.eq(50);
      sut.object.bounds.top.should.eq(150);
      sut.object.bounds.bottom.should.eq(400);
    });

    it("should try to shrink bottom of top zone", () => {
      const sut = new LayoutMock(new Rectangle(100, 200, 200, 400));
      sut.topZone = new LayoutMock(new Rectangle(100, 100, 300, 150));
      const spy = sinon.spy();
      sut.topZone.tryShrinkBottom = spy;

      sut.tryGrowTop(100);

      spy.calledOnce.should.true;
    });

    it("should fill shrunk top zone", () => {
      const sut = new LayoutMock(new Rectangle(100, 200, 200, 400));
      sut.topZone = new LayoutMock(new Rectangle(100, 100, 300, 150));
      sut.topZone.tryShrinkBottom = () => 25;
      sut.tryGrowTop(100);

      sut.bounds.top.should.eq(200 - 50 - 25);
      sut.bounds.bottom.should.eq(400);
    });

    it("should not grow top if layout is not resizable", () => {
      const sut = TypeMoq.Mock.ofInstance(new Layout(new Rectangle(100, 200, 200, 400), root.object));
      sut.callBase = true;
      sut.setup((x) => x.isResizable).returns(() => false);

      sut.object.tryGrowTop(100).should.eq(0);
      sut.object.bounds.top.should.eq(200);
      sut.object.bounds.bottom.should.eq(400);
    });
  });

  describe("#tryShrinkTop()", () => {
    it("should throw for negative", () => {
      const sut = new LayoutMock(new Rectangle());
      (() => { sut.tryShrinkTop(-100); }).should.throw();
    });

    it("should shrink in size", () => {
      const sut = new LayoutMock(new Rectangle(100, 200, 200, 600));
      sut.tryShrinkTop(100);

      sut.bounds.top.should.eq(300);
      sut.bounds.bottom.should.eq(600);
    });

    it("should shrink to minHeight", () => {
      const sut = new LayoutMock(new Rectangle(100, 200, 200, 400));
      sut.minHeight = 150;
      sut.tryShrinkTop(300);

      sut.bounds.top.should.eq(250);
      sut.bounds.bottom.should.eq(400);
    });

    it("should try to shrink top of bottom zone", () => {
      const sut = new LayoutMock(new Rectangle(100, 200, 200, 400));
      sut.bottomZone = new LayoutMock(new Rectangle());
      const spy = sinon.spy();
      sut.bottomZone.tryShrinkTop = spy;

      sut.tryShrinkTop(100);

      spy.should.have.been.called;
    });

    it("should move by bottom zone shrunk amount", () => {
      const sut = new LayoutMock(new Rectangle(100, 200, 200, 400));
      sut.bottomZone = new LayoutMock(new Rectangle());
      sut.bottomZone.tryShrinkTop = () => 25;
      sut.tryShrinkTop(100);

      sut.bounds.top.should.eq(225);
      sut.bounds.bottom.should.eq(425);
    });

    it("should shrunk then move", () => {
      const sut = new LayoutMock(new Rectangle(100, 200, 200, 400));
      sut.bottomZone = new LayoutMock(new Rectangle(100, 425, 200, 500));
      sut.minHeight = 100;
      sut.bottomZone.tryShrinkTop = () => 0;

      const shrunk = sut.tryShrinkTop(150);

      shrunk.should.eq(125);
      sut.bounds.top.should.eq(200 + 100 + 25);
      sut.bounds.bottom.should.eq(400 + 25);
    });
  });

  describe("#tryGrowBottom()", () => {
    it("should throw for negative", () => {
      const sut = new LayoutMock(new Rectangle());
      (() => { sut.tryGrowBottom(-100); }).should.throw();
    });

    it("should grow bottom", () => {
      const sut = new LayoutMock(new Rectangle(0, 50, 10, 150));
      sut.bottomZone = new LayoutMock(new Rectangle(0, 500, 10, 650));
      const grown = sut.tryGrowBottom(100);

      grown.should.eq(100);
      sut.bounds.top.should.eq(50);
      sut.bounds.bottom.should.eq(250);
    });

    it("should not grow beyond bottom zone", () => {
      const sut = new LayoutMock(new Rectangle(0, 50, 10, 150));
      sut.bottomZone = new LayoutMock(new Rectangle(0, 200, 10, 250));
      const grown = sut.tryGrowBottom(100);

      grown.should.eq(50);
      sut.bounds.top.should.eq(50);
      sut.bounds.bottom.should.eq(200);
    });

    it("should try to shrink top of bottom zone when trying to grow beyond bottom zone", () => {
      let shrinkBottomZoneBy = 0;
      const sut = new LayoutMock(new Rectangle(0, 50, 10, 150));
      sut.bottomZone = new LayoutMock(new Rectangle(0, 225, 10, 250));
      sut.bottomZone.tryShrinkTop = (px) => {
        shrinkBottomZoneBy = px;
        return 0;
      };
      sut.tryGrowBottom(100);

      shrinkBottomZoneBy.should.eq(25);
    });

    it("should grow bottom by amount of bottom zone shrunk", () => {
      const sut = new LayoutMock(new Rectangle(0, 50, 10, 150));
      sut.bottomZone = new LayoutMock(new Rectangle(0, 225, 10, 250));
      sut.bottomZone.tryShrinkTop = (px) => {
        return px;
      };
      const grown = sut.tryGrowBottom(100);

      grown.should.eq(100);
      sut.bounds.top.should.eq(50);
      sut.bounds.bottom.should.eq(250);
    });
  });

  describe("#tryShrinkBottom()", () => {
    it("should shrink in size", () => {
      const sut = new LayoutMock(new Rectangle(100, 200, 200, 600));
      sut.tryShrinkBottom(100);

      sut.bounds.top.should.eq(200);
      sut.bounds.bottom.should.eq(500);
    });

    it("should throw for negative", () => {
      const sut = new LayoutMock(new Rectangle());
      (() => { sut.tryShrinkBottom(-100); }).should.throw();
    });

    it("should shrink to minHeight", () => {
      const sut = new LayoutMock(new Rectangle(100, 0, 200, 400));
      sut.minHeight = 50;
      sut.tryShrinkBottom(1000);

      sut.bounds.top.should.eq(0);
      sut.bounds.bottom.should.eq(50);
    });

    it("should try to shrink bottom of top zone", () => {
      const sut = new LayoutMock(new Rectangle(100, 200, 200, 400));
      sut.topZone = new LayoutMock(new Rectangle());
      const spy = sinon.spy();
      sut.topZone.tryShrinkBottom = spy;

      sut.tryShrinkBottom(100);

      spy.should.have.been.called;
    });

    it("should move by top zone shrunk amount", () => {
      const sut = new LayoutMock(new Rectangle(0, 150, 10, 200));
      sut.topZone = new LayoutMock(new Rectangle(0, 100, 10, 150));
      sut.topZone.tryShrinkBottom = () => 25;
      sut.tryShrinkBottom(100);

      sut.bounds.top.should.eq(150 - 25);
      sut.bounds.bottom.should.eq(200 - 25);
    });

    it("should move beside top zone", () => {
      const topZone = TypeMoq.Mock.ofType<Layout>();
      topZone.setup((x) => x.bounds).returns(() => new Rectangle(0, 100, 10, 150));
      topZone.setup((x) => x.tryShrinkBottom(TypeMoq.It.isAnyNumber())).returns(() => 0);
      const sut = TypeMoq.Mock.ofInstance(new Layout(new Rectangle(0, 170, 10, 200), root.object));
      sut.callBase = true;
      sut.setup((x) => x.topZone).returns(() => topZone.object);

      sut.object.tryShrinkBottom(100).should.eq(20);
      sut.object.bounds.top.should.eq(150);
      sut.object.bounds.bottom.should.eq(180);
    });
  });

  describe("#tryGrowLeft()", () => {
    it("should throw for negative", () => {
      const sut = new LayoutMock(new Rectangle());
      (() => { sut.tryGrowLeft(-100); }).should.throw();
    });

    it("should grow left", () => {
      const sut = new LayoutMock(new Rectangle(300, 0, 400, 10));
      const grown = sut.tryGrowLeft(100);

      grown.should.eq(100);
      sut.bounds.left.should.eq(200);
      sut.bounds.right.should.eq(400);
    });

    it("should not grow beyond left zone", () => {
      const leftZone = TypeMoq.Mock.ofType<Layout>();
      leftZone.setup((x) => x.bounds).returns(() => new Rectangle(100, 0, 250, 10));
      leftZone.setup((x) => x.tryShrinkRight(TypeMoq.It.isAnyNumber())).returns(() => 0);
      const sut = TypeMoq.Mock.ofInstance(new Layout(new Rectangle(300, 0, 400, 10), root.object));
      sut.setup((x) => x.leftZone).returns(() => leftZone.object);
      sut.callBase = true;

      sut.object.tryGrowLeft(100).should.eq(50);
      sut.object.bounds.left.should.eq(250);
      sut.object.bounds.right.should.eq(400);
    });

    it("should try to shrink right of left zone when trying to grow beyond left zone", () => {
      let shrinkLeftZoneBy = 0;
      const sut = new LayoutMock(new Rectangle(325, 0, 600, 10));
      sut.leftZone = new LayoutMock(new Rectangle(100, 0, 300, 10));
      sut.leftZone.tryShrinkRight = (px) => {
        shrinkLeftZoneBy = px;
        return 0;
      };
      sut.tryGrowLeft(50);

      shrinkLeftZoneBy.should.eq(25);
    });

    it("should grow left by amount of left zone shrunk", () => {
      const sut = new LayoutMock(new Rectangle(600, 0, 900, 10));
      sut.leftZone = new LayoutMock(new Rectangle(100, 0, 500, 10));
      sut.leftZone.tryShrinkRight = (px) => px;
      const grown = sut.tryGrowLeft(150);

      grown.should.eq(150);
      sut.bounds.left.should.eq(450);
      sut.bounds.right.should.eq(900);
    });

    it("should not grow above original size", () => {
      const leftZone = TypeMoq.Mock.ofType<Layout>();
      leftZone.setup((x) => x.tryShrinkRight(TypeMoq.It.isAnyNumber())).returns(() => 0);
      leftZone.setup((x) => x.bounds).returns(() => new Rectangle(100, 0, 200, 0));
      const sut = TypeMoq.Mock.ofInstance(new Layout(new Rectangle(200, 10, 300, 20), root.object));
      sut.callBase = true;
      sut.setup((x) => x.leftZone).returns(() => leftZone.object);

      sut.object.tryGrowLeft(10).should.eq(0);
      sut.object.bounds.left.should.eq(200);
      sut.object.bounds.right.should.eq(300);
    });
  });

  describe("#tryShrinkLeft()", () => {
    it("should throw for negative", () => {
      const sut = new LayoutMock(new Rectangle());
      (() => { sut.tryShrinkLeft(-100); }).should.throw();
    });

    it("should shrink in size", () => {
      const sut = new LayoutMock(new Rectangle(200, 0, 600, 10));
      sut.tryShrinkLeft(100);

      sut.bounds.left.should.eq(300);
      sut.bounds.right.should.eq(600);
    });

    it("should shrink to min width", () => {
      const sut = new LayoutMock(new Rectangle(0, 0, 600, 10));
      sut.minWidth = 50;
      sut.tryShrinkLeft(1000);

      sut.bounds.left.should.eq(550);
      sut.bounds.right.should.eq(600);
    });

    it("should shrink left of right zone", () => {
      let shrunkBy = 0;
      const sut = new LayoutMock(new Rectangle(0, 0, 200, 10));
      sut.minWidth = 100;
      sut.rightZone = new LayoutMock(new Rectangle());
      sut.rightZone.tryShrinkLeft = (px: number) => {
        shrunkBy = px;
        return 0;
      };
      sut.tryShrinkLeft(150);

      shrunkBy.should.eq(50);
    });

    it("should move right by shrunk amount", () => {
      const sut = new LayoutMock(new Rectangle(600, 0, 800, 10));
      sut.rightZone = new LayoutMock(new Rectangle());
      sut.rightZone.tryShrinkLeft = () => 25;
      sut.tryShrinkLeft(100);

      sut.bounds.left.should.eq(600 + 25);
      sut.bounds.right.should.eq(800 + 25);
    });

    it("should move beside right zone", () => {
      const sut = new LayoutMock(new Rectangle(300, 0, 400, 10));
      sut.rightZone = new LayoutMock(new Rectangle(500, 0, 600, 10));
      sut.tryShrinkLeft(1000);

      sut.bounds.left.should.eq(400);
      sut.bounds.right.should.eq(500);
    });
  });

  describe("#tryGrowRight()", () => {
    it("should throw for negative", () => {
      const sut = new LayoutMock(new Rectangle());
      (() => { sut.tryGrowRight(-100); }).should.throw();
    });

    it("should grow right", () => {
      const sut = new LayoutMock(new Rectangle(300, 0, 400, 10));
      sut.rightZone = new LayoutMock(new Rectangle(600, 0, 800, 10));
      const grown = sut.tryGrowRight(100);

      grown.should.eq(100);
      sut.bounds.left.should.eq(300);
      sut.bounds.right.should.eq(500);
    });

    it("should not grow beyond right zone", () => {
      const sut = new LayoutMock(new Rectangle(300, 0, 400, 10));
      sut.rightZone = new LayoutMock(new Rectangle(450, 0, 550, 10));
      const grown = sut.tryGrowRight(100);

      grown.should.eq(50);
      sut.bounds.left.should.eq(300);
      sut.bounds.right.should.eq(450);
    });

    it("should try to shrink left of right zone when trying to grow beyond right zone", () => {
      let shrinkRightZoneBy = 0;
      const sut = new LayoutMock(new Rectangle(100, 0, 225, 10));
      sut.rightZone = new LayoutMock(new Rectangle(250, 0, 400, 10));
      sut.rightZone.tryShrinkLeft = (px) => {
        shrinkRightZoneBy = px;
        return 0;
      };
      sut.tryGrowRight(50);

      shrinkRightZoneBy.should.eq(25);
    });

    it("should grow right by amount of right zone shrunk", () => {
      const sut = new LayoutMock(new Rectangle(100, 0, 200, 10));
      sut.rightZone = new LayoutMock(new Rectangle(200, 0, 300, 10));
      sut.rightZone.tryShrinkLeft = () => 45;

      const grown = sut.tryGrowRight(150);

      grown.should.eq(45);
      sut.bounds.left.should.eq(100);
      sut.bounds.right.should.eq(200 + 45);
    });
  });

  describe("#tryShrinkRight()", () => {
    it("should throw for negative", () => {
      const sut = new LayoutMock(new Rectangle());
      (() => { sut.tryShrinkRight(-100); }).should.throw();
    });

    it("should shrink in size", () => {
      const sut = new LayoutMock(new Rectangle(200, 0, 600, 10));
      sut.tryShrinkRight(100);

      sut.bounds.left.should.eq(200);
      sut.bounds.right.should.eq(500);
    });

    it("should shrink to min width", () => {
      const sut = new LayoutMock(new Rectangle(0, 0, 600, 10));
      sut.minWidth = 50;
      sut.tryShrinkRight(1000);

      sut.bounds.left.should.eq(0);
      sut.bounds.right.should.eq(50);
    });

    it("should shrink right of left zone", () => {
      let shrunkBy = 0;
      const sut = new LayoutMock(new Rectangle(0, 0, 200, 10));
      sut.minWidth = 100;
      sut.leftZone = new LayoutMock(new Rectangle());
      sut.leftZone.tryShrinkRight = (px: number) => {
        shrunkBy = px;
        return 0;
      };
      sut.tryShrinkRight(150);

      shrunkBy.should.eq(50);
    });

    it("should move left by shrunk amount", () => {
      const sut = new LayoutMock(new Rectangle(600, 0, 800, 10));
      sut.leftZone = new LayoutMock(new Rectangle(100, 0, 600, 10));
      sut.leftZone.tryShrinkRight = () => 25;
      sut.tryShrinkRight(100);

      sut.bounds.left.should.eq(600 - 25);
      sut.bounds.right.should.eq(800 - 25);
    });

    it("should move beside left zone", () => {
      const leftZone = TypeMoq.Mock.ofType<Layout>();
      leftZone.setup((x) => x.bounds).returns(() => new Rectangle(100, 0, 200, 10));
      leftZone.setup((x) => x.tryShrinkRight(TypeMoq.It.isAnyNumber())).returns(() => 0);
      const sut = TypeMoq.Mock.ofInstance(new Layout(new Rectangle(300, 0, 400, 10), root.object));
      sut.callBase = true;
      sut.setup((x) => x.leftZone).returns(() => leftZone.object);

      sut.object.tryShrinkRight(1000).should.eq(100);
      sut.object.bounds.left.should.eq(200);
      sut.object.bounds.right.should.eq(300);
    });
  });
});
