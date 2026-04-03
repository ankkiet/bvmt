// modules/ui.js

const ui = {
    isDarkMode: false,
    seasonalEffects: {},
    currentTheme: 'default',

    toggleDarkMode() {
        this.isDarkMode = !this.isDarkMode;
        this.updateTheme();
    },

    setSeasonalEffect(season) {
        this.seasonalEffects = this.getSeasonalEffects(season);
    },

    getSeasonalEffects(season) {
        const effects = {
            winter: { background: '#D4E6F1', color: '#34495E' },
            spring: { background: '#A8E6CF', color: '#005B5C' },
            summer: { background: '#FFABAB', color: '#C45045' },
            autumn: { background: '#F7C6C7', color: '#6A5B4D' }
        };
        return effects[season] || {};  
    },

    updateTheme() {
        const root = document.documentElement;
        if (this.isDarkMode) {
            root.style.setProperty('--background', '#121212');
            root.style.setProperty('--color', '#FFFFFF');
        } else {
            root.style.setProperty('--background', '#FFFFFF');
            root.style.setProperty('--color', '#000000');
        }
        // Apply seasonal effects
        const { background, color } = this.seasonalEffects;
        if (background) {
            root.style.setProperty('--background', background);
        }
        if (color) {
            root.style.setProperty('--color', color);
        }
    },

    setTheme(theme) {
        this.currentTheme = theme;
        // Logic to apply the theme goes here
    }
};

export default ui;