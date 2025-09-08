#!/bin/bash

# Create simple purple square PNG icons using sips and ImageMagick alternatives
# These are placeholder icons - replace with proper branded icons for production

# Function to create a solid color PNG
create_solid_png() {
    local size=$1
    local output=$2
    
    # Create a purple square using sips by converting from the .ico file
    # First, let's copy and resize the existing favicon
    if [ -f "public/frontier.ico" ]; then
        sips -z $size $size public/frontier.ico --out $output 2>/dev/null
    else
        # If no ico file, create a simple purple PNG using printf and xxd
        # This creates a minimal 1x1 purple PNG, then we'll resize it
        echo "Creating placeholder $output"
        
        # Create a 1x1 purple pixel PNG (base64 encoded)
        echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" | base64 -d > /tmp/purple_pixel.png
        
        # Resize to desired size
        sips -z $size $size /tmp/purple_pixel.png --out $output
    fi
}

# Generate standard icons
create_solid_png 192 "public/icon-192.png"
create_solid_png 512 "public/icon-512.png"

# Generate maskable icons (same for now, should have padding in production)
cp "public/icon-192.png" "public/icon-maskable-192.png" 2>/dev/null || true
cp "public/icon-512.png" "public/icon-maskable-512.png" 2>/dev/null || true

# Generate Apple touch icon
create_solid_png 180 "public/apple-touch-icon.png"

echo "PNG icons created!"
echo "Note: These are placeholder icons. Replace with proper Frontier Tower branded icons for production."
ls -la public/*.png 2>/dev/null | grep -E "icon|apple" || true