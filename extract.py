import os

with open('src-tauri/src/server.rs', 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = 'const WEB_PLAYER_HTML: &str = r###"'
end_marker = '"###;'

start_idx = content.find(start_marker)
if start_idx != -1:
    end_idx = content.find(end_marker, start_idx)
    html_content = content[start_idx + len(start_marker):end_idx]
    
    with open('src-tauri/src/web_player.html', 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    new_content = content[:start_idx] + 'const WEB_PLAYER_HTML: &str = include_str!("web_player.html");\n' + content[end_idx + len(end_marker):]
    with open('src-tauri/src/server.rs', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print('Extraction successful!')
else:
    print('Marker not found!')
