// Pure geometry helper shared by the Business Suite content script and tests.
// A null direction is intentional: layout that cannot prove a side is unknown.
(function attachPageDirection(root) {
    const DEFAULT_TOLERANCE_PX = 12;

    function isFiniteRect(rect) {
        return rect
            && Number.isFinite(rect.left)
            && Number.isFinite(rect.right)
            && rect.right > rect.left;
    }

    function classifyByContainerEdges({ containerRect, bubbleRect, tolerancePx = DEFAULT_TOLERANCE_PX } = {}) {
        if (!isFiniteRect(containerRect) || !isFiniteRect(bubbleRect)) {
            return { direction: null, source: 'unknown', confidence: 'unknown' };
        }

        const leftGap = bubbleRect.left - containerRect.left;
        const rightGap = containerRect.right - bubbleRect.right;
        const tolerance = Number.isFinite(tolerancePx) && tolerancePx >= 0
            ? tolerancePx
            : DEFAULT_TOLERANCE_PX;

        if (rightGap + tolerance < leftGap) {
            return { direction: true, source: 'container_edge', confidence: 'high', leftGap, rightGap };
        }
        if (leftGap + tolerance < rightGap) {
            return { direction: false, source: 'container_edge', confidence: 'high', leftGap, rightGap };
        }
        return { direction: null, source: 'unknown', confidence: 'unknown', leftGap, rightGap };
    }

    const api = { classifyByContainerEdges };
    if (root) root.FbCrmPageDirection = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
