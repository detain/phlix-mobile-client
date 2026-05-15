.PHONY: all package install dev clean test

# Roku IP address (set via environment or edit here)
ROKU_IP ?= 192.168.1.100
ROKU_DEV ?= rokudev
ROKU_PASSWORD ?= rokipassword

# Package name
PKG_NAME = phlex
PKG_VERSION = 1.0.1

all: package

# Create zip package for sideloading
package:
	@echo "Creating $(PKG_NAME).zip..."
	zip -r $(PKG_NAME).zip manifest source images

# Install to Roku device
install: package
	@echo "Installing to Roku at $(ROKU_IP)..."
	curl -v -u $(ROKU_DEV):$(ROKU_PASSWORD) -X POST \
		http://$(ROKU_IP):8060/install/app \
		-F "archive=@$(PKG_NAME).zip" \
		-F "manifest=@manifest"

# Launch the app (after install)
launch:
	@echo "Launching $(PKG_NAME)..."
	curl -u $(ROKU_DEV):$(ROKU_PASSWORD) -X POST \
		http://$(ROKU_IP):8060/launch/dev \
		--data-urlencode "channel=dev"

# Stop the app
stop:
	@echo "Stopping $(PKG_NAME)..."
	curl -u $(ROKU_DEV):$(ROKU_PASSWORD) -X POST \
		http://$(ROKU_IP):8060/keypress/home`

# Development server (requires rokupkg)
dev-install: package
	@echo "Installing to dev mode..."
	rokupkg --install $(PKG_NAME).zip

# Clean build artifacts
clean:
	@echo "Cleaning..."
	rm -f $(PKG_NAME).zip

# Run tests
test:
	@echo "Running tests..."
	@echo "Note: BrightScript unit tests require device or emulator"
	@if [ -d tests ]; then find tests -name "*.test.brs" -exec echo "Found test: {}" \; ; fi

# Validate manifest
validate-manifest:
	@echo "Validating manifest..."
	@grep -q "^title=" manifest && echo "Manifest valid" || (echo "Manifest invalid: missing title" && exit 1)

# Default target
.DEFAULT_GOAL := package