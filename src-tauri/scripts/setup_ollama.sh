set -e


print_msg() {
    echo "========================================"
    echo "$1"
}


install_homebrew() {
    print_msg "Checking for Homebrew installation..."
    
    if command -v brew >/dev/null 2>&1; then
        echo "Homebrew is already installed."
    else
        echo "Homebrew is not installed. Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        
        eval "$(/opt/homebrew/bin/brew shellenv)"
        
        echo "Homebrew installed successfully."
    fi
}


install_ollama() {
    print_msg "Checking Ollama installation..."
    
    # check if ollama is already installed
    if [ -d "/Applications/Ollama.app" ]; then
        echo "Ollama app is already installed in /Applications/Ollama.app"
        # check the cli
        if [ -f "/Applications/Ollama.app/Contents/Resources/ollama" ]; then
            echo "Ollama CLI is available from the app installation."
            
            # add the app's CLI to PATH
            if ! command -v ollama >/dev/null 2>&1; then
                echo "Adding Ollama CLI to PATH..."
                # create a symlink
                if [ ! -f "/usr/local/bin/ollama" ]; then
                    sudo ln -sf "/Applications/Ollama.app/Contents/Resources/ollama" "/usr/local/bin/ollama"
                    echo "Created symlink for Ollama CLI at /usr/local/bin/ollama"
                fi
            fi
            
            echo "Ollama is already installed. Skipping installation..."
            return 0
        else
            echo "Warning: Ollama app exists but CLI not found. This may be an incomplete installation."
            echo "Removing existing app to perform clean installation..."
            sudo rm -rf "/Applications/Ollama.app"
        fi
    fi
    
    # check for CLI availability
    if command -v ollama >/dev/null 2>&1; then
        echo "Ollama CLI is already available. Checking installation method..."
        
        # check if installed via Homebrew cask
        if brew list --cask ollama >/dev/null 2>&1; then
            echo "Ollama is installed via Homebrew cask. Skipping installation..."
            return 0
        fi
        
        # check if installed via Homebrew formula
        if brew list ollama >/dev/null 2>&1; then
            echo "Ollama is installed via Homebrew formula. Skipping installation..."
            return 0
        fi
        
        # still skip if cli exists
        echo "Ollama CLI found at: $(which ollama). Skipping installation..."
        return 0
    fi
    
    # finally install ollama
    print_msg "Installing Ollama executable using Homebrew..."
    
    echo "Installing Ollama via Homebrew cask..."
    if ! brew install --cask ollama; then
        echo "Installation failed. Please check Homebrew logs."
        exit 1
    fi
    
    # final verification
    if [ -d "/Applications/Ollama.app" ] && command -v ollama >/dev/null 2>&1; then
        echo "Ollama installation completed successfully."
        echo "App location: /Applications/Ollama.app"
        echo "CLI location: $(which ollama)"
    else
        echo "Warning: Ollama installation may be incomplete."
        if [ ! -d "/Applications/Ollama.app" ]; then
            echo "  - App not found at /Applications/Ollama.app"
        fi
        if ! command -v ollama >/dev/null 2>&1; then
            echo "  - CLI not available in PATH"
        fi
    fi
}


setup_ssh() {
    print_msg "Setting up SSH key..."
    
    SSH_DIR="$HOME/.ssh"
    SSH_KEY="$SSH_DIR/id_rsa"
    
    if [ -f "$SSH_KEY" ]; then
        echo "SSH key already exists at $SSH_KEY."
    else
        echo "SSH key does not exist. Creating a new SSH key."
        mkdir -p "$SSH_DIR"
        ssh-keygen -t rsa -b 4096 -N "" -f "$SSH_KEY"
        chmod 600 "$SSH_KEY"
        echo "SSH key generated at $SSH_KEY."
    fi
}


start_ollama_service() {
    print_msg "Starting Ollama service..."

    OLLAMA_PATH="$(which ollama)"

    if [ -z "$OLLAMA_PATH" ]; then
        echo "Error: 'ollama' executable not found in PATH."
        exit 1
    fi

    echo "Ollama executable found at: $OLLAMA_PATH"

    mkdir -p "$HOME/.ollama"

    # check if ollama is already running
    if pgrep -f "ollama serve" > /dev/null; then
        echo "Ollama serve process is already running."
    else
        echo "Starting Ollama service directly..."
        # start ollama in background
        nohup "$OLLAMA_PATH" serve > "$HOME/.ollama/ollama.log" 2> "$HOME/.ollama/ollama.err" &
        echo "Ollama started in background with PID: $!"
    fi

    echo "Waiting for Ollama service to start..."
    sleep 5

    # check if service is running
    SERVICE_RUNNING=false
    
    if pgrep -f "ollama serve" > /dev/null; then
        echo "Ollama serve process is running."
        SERVICE_RUNNING=true
    fi

    if curl -s http://localhost:11434/api/version >/dev/null 2>&1; then
        echo "Ollama API is responding on port 11434."
        SERVICE_RUNNING=true
    fi

    if [ "$SERVICE_RUNNING" = true ]; then
        echo "Ollama service is running successfully."
    else
        echo "Warning: Ollama service may not be running properly."
        echo "Check logs at $HOME/.ollama/ for troubleshooting."
        echo "You can also try starting it manually with: ollama serve"
    fi
}


pull_ollama_model() {
    print_msg "Pulling the 'gemma3n:e2b' model from Ollama Model Garden..."
    
    if ! command -v ollama >/dev/null 2>&1; then
        echo "Error: Ollama CLI is not installed or not in PATH."
        exit 1
    fi

    echo "Checking if Ollama service is accessible..."
    RETRY_COUNT=0
    MAX_RETRIES=3
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if curl -s http://localhost:11434/api/version >/dev/null 2>&1; then
            echo "Ollama service is accessible."
            break
        else
            echo "Ollama service not accessible, attempt $((RETRY_COUNT + 1))/$MAX_RETRIES..."
            if [ $RETRY_COUNT -eq 0 ]; then
                echo "Trying to start Ollama service manually..."
                ollama serve &
                sleep 5
            fi
            sleep 3
            RETRY_COUNT=$((RETRY_COUNT + 1))
        fi
    done
    
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        echo "Warning: Could not connect to Ollama service. Trying to pull model anyway..."
    fi

    if ollama list | grep -q "gemma3n:e2b"; then
        echo "Model 'gemma3n:e2b' is already available."
    else
        echo "Pulling model 'gemma3n:e2b'..."
        echo "Note: This is a large model (5.6GB) and may take several minutes to download..."
        if timeout 3000 ollama pull gemma3n:e2b; then
            echo "Model 'gemma3n:e2b' pulled successfully."
        else
            echo "Warning: Model pull failed or timed out. You may need to pull it manually later."
            echo "Run: ollama pull gemma3n:e2b"
            echo "Large models can take 5-10 minutes depending on your internet connection."
        fi
    fi
}


make_model_available() {
    print_msg "Verifying the 'gemma3n:e2b' model availability..."
    
    if ollama list | grep -q "gemma3n:e2b"; then
        echo "Model 'gemma3n:e2b' is available for use."
    else
        echo "Model 'gemma3n:e2b' is not available. You may need to pull it manually:"
        echo "ollama pull gemma3n:e2b"
    fi
}


main() {
    install_homebrew
    install_ollama
    setup_ssh
    start_ollama_service
    pull_ollama_model
    make_model_available
    print_msg "Ollama setup and model deployment completed successfully."
}


main