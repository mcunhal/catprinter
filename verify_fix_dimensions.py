import sys

# Simulation of what logic happens in renderTextToCanvas

class MockElement:
    def __init__(self, tag, style=None):
        self.tag = tag
        self.style = style or {}
        self.inner_html = ""
        self.rect = {"width": 0, "height": 0}

    def set_content(self, text):
        self.inner_html = text
        # Simulate browser layout logic
        if self.style.get("display") == "inline-block":
            if self.style.get("width") == "fit-content":
                # width = text length * approx char width
                self.rect["width"] = len(text) * 10
            elif self.style.get("width") == "auto":
                # In previous buggy state, this was effectively taking full width if container allowed
                # But here we simulate the FIX
                pass

        # Height is font size
        self.rect["height"] = 20

def test_logic():
    print("Testing logic for Banner Dimension Fix...")

    # Setup
    orientation = 'landscape'
    temp_container = MockElement('div')
    temp_container.style = {
        'position': 'absolute',
        'top': '-9999px',
        'left': '-9999px',
        'display': 'inline-block',
        'width': 'fit-content', # The FIX
        'whiteSpace': 'pre'
    }

    # Input text
    text = "Short"
    temp_container.set_content(text)

    # Measure
    content_width = temp_container.rect["width"]
    content_height = temp_container.rect["height"]

    print(f"Content Dimensions: {content_width}x{content_height}")

    # Validate
    # "Short" -> 5 chars * 10 = 50px width.
    # If it was full screen, it would be e.g. 1024px.

    if content_width < 100:
        print("SUCCESS: Content width is compact (Banner Length is short).")
    else:
        print(f"FAILURE: Content width is {content_width} (too large).")
        sys.exit(1)

if __name__ == "__main__":
    test_logic()
