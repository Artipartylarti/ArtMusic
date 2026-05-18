import os, glob

def replace_in_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace white and black shades with teal vars
    content = content.replace("'#fff'", "'var(--text-primary)'")
    content = content.replace('"#fff"', '"var(--text-primary)"')
    content = content.replace("'#ffffff'", "'var(--text-primary)'")
    
    # In buttons that have accent background, we should use surface-0 for text
    content = content.replace("color: 'var(--text-primary)',\n                          border: 'none'", "color: 'var(--surface-0)',\n                          border: 'none'")
    content = content.replace("color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer',\n                  marginTop: 10", "color: 'var(--surface-0)', fontWeight: 600, cursor: 'pointer',\n                  marginTop: 10")
    
    # Indigo to teal
    content = content.replace("'linear-gradient(135deg, #6366f1, #8b5cf6)'", "'linear-gradient(135deg, var(--accent), var(--text-muted))'")
    content = content.replace("'rgba(99, 102, 241, 0.08)'", "'var(--accent-dim)'")
    content = content.replace("'rgba(99, 102, 241, 0.15)'", "'var(--accent-border)'")
    content = content.replace("'rgba(99, 102, 241, 0.1)'", "'var(--accent-dim)'")
    content = content.replace("rgba(99, 102, 241, 0.08)", "var(--accent-dim)")
    content = content.replace("rgba(99, 102, 241, 0.15)", "var(--accent-border)")
    content = content.replace("rgba(99, 102, 241, 0.1)", "var(--accent-dim)")
    
    # In Player.tsx stroke="white"
    content = content.replace('stroke="white"', 'stroke="var(--surface-0)"')

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

for f in glob.glob('src/**/*.tsx', recursive=True):
    replace_in_file(f)
